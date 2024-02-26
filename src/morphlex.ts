type IdSet = Set<string>;
type IdMap = WeakMap<Node, IdSet>;

export function morph(node: ChildNode, reference: ChildNode): void {
	const idMap: IdMap = new WeakMap();

	if (isParentNode(node) && isParentNode(reference)) {
		populateIdSets(node, idMap);
		populateIdSets(reference, idMap);
	}

	morphNodes(node, reference, idMap);
}

// For each node with an ID, push that ID into the IdSet on the IdMap, for each of its parent elements.
function populateIdSets(node: ParentNode, idMap: IdMap): void {
	const elementsWithIds: NodeListOf<Element> = node.querySelectorAll("[id]");

	for (const elementWithId of elementsWithIds) {
		const id = elementWithId.id;

		// Ignore empty IDs
		if (id === "") continue;

		let current: Element | null = elementWithId;

		while (current) {
			const idSet: IdSet | undefined = idMap.get(current);
			idSet ? idSet.add(id) : idMap.set(current, new Set([id]));
			if (current === elementWithId) break;
			current = current.parentElement;
		}
	}
}

// This is where we actually morph the nodes. The `morph` function exists to set up the `idMap`.
function morphNodes(node: ChildNode, ref: ChildNode, idMap: IdMap): void {
	if (isElement(node) && isElement(ref) && node.tagName === ref.tagName) {
		// We need to check if the element is an input, option, or textarea here, because they have
		// special attributes not covered by the isEqualNode check.
		if (!isInput(node) && !isOption(node) && !isTextArea(node) && node.isEqualNode(ref)) return;
		else {
			if (node.hasAttributes() || ref.hasAttributes()) morphAttributes(node, ref);
			if (node.hasChildNodes() || ref.hasChildNodes()) morphChildNodes(node, ref, idMap);
		}
	} else {
		if (node.isEqualNode(ref)) return;
		else if (isText(node) && isText(ref)) {
			if (node.textContent !== ref.textContent) node.textContent = ref.textContent;
		} else if (isComment(node) && isComment(ref)) {
			if (node.nodeValue !== ref.nodeValue) node.nodeValue = ref.nodeValue;
		} else node.replaceWith(ref.cloneNode(true));
	}
}

function morphAttributes(elm: Element, ref: Element): void {
	// Remove any excess attributes from the element that aren’t present in the reference.
	for (const { name } of elm.attributes) ref.hasAttribute(name) || elm.removeAttribute(name);

	// Copy attributes from the reference to the element, if they don’t already match.
	for (const { name, value } of ref.attributes) elm.getAttribute(name) === value || elm.setAttribute(name, value);

	elm.nodeValue;

	// For certain types of elements, we need to do some extra work to ensure
	// the element’s state matches the reference elements’ state.
	if (isInput(elm) && isInput(ref)) {
		if (elm.checked !== ref.checked) elm.checked = ref.checked;
		if (elm.disabled !== ref.disabled) elm.disabled = ref.disabled;
		if (elm.indeterminate !== ref.indeterminate) elm.indeterminate = ref.indeterminate;
		if (elm.type !== "file" && elm.value !== ref.value) elm.value = ref.value;
	} else if (isOption(elm) && isOption(ref) && elm.selected !== ref.selected) elm.selected = ref.selected;
	else if (isTextArea(elm) && isTextArea(ref)) {
		if (elm.value !== ref.value) elm.value = ref.value;

		const text = elm.firstChild;
		if (text && isText(text) && text.textContent !== ref.value) text.textContent = ref.value;
	}
}

// Iterates over the child nodes of the reference element, morphing the main element’s child nodes to match.
function morphChildNodes(element: Element, ref: Element, idMap: IdMap): void {
	const childNodes = [...element.childNodes];
	const refChildNodes = [...ref.childNodes];

	for (let i = 0; i < refChildNodes.length; i++) {
		const child = childNodes.at(i);
		const refChild = refChildNodes.at(i);

		if (child && refChild) morphChildNode(child, refChild, element, idMap);
		else if (refChild) element.appendChild(refChild.cloneNode(true));
		else if (child) child.remove();
	}

	// Remove any excess child nodes from the main element. This is separate because
	// the loop above might modify the length of the main element’s child nodes.
	while (element.childNodes.length > ref.childNodes.length) element.lastChild?.remove();
}

function morphChildNode(child: ChildNode, ref: ChildNode, parent: Element, idMap: IdMap): void {
	if (isElement(child) && isElement(ref)) morphChildElement(child, ref, parent, idMap);
	else morphNodes(child, ref, idMap);
}

function morphChildElement(child: Element, ref: Element, parent: Element, idMap: IdMap): void {
	const refIdSet = idMap.get(ref);

	// Generate the array in advance of the loop
	const refSetArray = refIdSet ? [...refIdSet] : [];

	let currentNode: ChildNode | null = child;
	let nextMatchByTagName: ChildNode | null = null;

	// Try find a match by idSet, while also looking out for the next best match by tagName.
	while (currentNode) {
		if (isElement(currentNode)) {
			if (currentNode.id === ref.id) {
				parent.insertBefore(currentNode, child);
				return morphNodes(currentNode, ref, idMap);
			} else if (currentNode.id !== "") {
				const currentIdSet = idMap.get(currentNode);

				if (currentIdSet && refSetArray.some((it) => currentIdSet.has(it))) {
					parent.insertBefore(currentNode, child);
					return morphNodes(currentNode, ref, idMap);
				}
			} else if (!nextMatchByTagName && currentNode.tagName === ref.tagName) {
				nextMatchByTagName = currentNode;
			}
		}

		currentNode = currentNode.nextSibling;
	}

	if (nextMatchByTagName) {
		parent.insertBefore(nextMatchByTagName, child);
		morphNodes(nextMatchByTagName, ref, idMap);
	} else child.replaceWith(ref.cloneNode(true));
}

// We cannot use `instanceof` when nodes might be from different documents,
// so we use type guards instead. This keeps TypeScript happy, while doing
// the necessary checks at runtime.

function isText(node: Node): node is Text {
	return node.nodeType === 3;
}

function isComment(node: Node): node is Comment {
	return node.nodeType === 8;
}

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

function isInput(element: Element): element is HTMLInputElement {
	return element.localName === "input";
}

function isOption(element: Element): element is HTMLOptionElement {
	return element.localName === "option";
}

function isTextArea(element: Element): element is HTMLTextAreaElement {
	return element.localName === "textarea";
}

function isParentNode(node: Node): node is ParentNode {
	return node.nodeType === 1 || node.nodeType === 9 || node.nodeType === 11;
}
