type IdSet = Set<string>;
type IdMap = Map<Node, IdSet>;

export function morph(node: ChildNode, guide: ChildNode): void {
	const idMap: IdMap = new Map();

	if (isParentNode(node) && isParentNode(guide)) {
		populateIdMapForNode(node, idMap);
		populateIdMapForNode(guide, idMap);
	}

	morphNodes(node, guide, idMap);
}

// For each node with an ID, push that ID into the IDSet on the IDMap, for each of its parent elements.
function populateIdMapForNode(node: ParentNode, idMap: IdMap): void {
	const elementsWithIds: NodeListOf<Element> = node.querySelectorAll("[id]");

	for (const elementWithId of elementsWithIds) {
		const id = elementWithId.id;
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
function morphNodes(node: ChildNode, guide: ChildNode, idMap: IdMap, insertBefore?: Node, parent?: Node): void {
	// TODO: We should extract this into a separate function.
	if (parent && insertBefore && insertBefore !== node) parent.insertBefore(guide, insertBefore);

	if (isText(node) && isText(guide)) {
		if (node.textContent !== guide.textContent) node.textContent = guide.textContent;
	} else if (isElement(node) && isElement(guide) && node.tagName === guide.tagName) {
		if (node.hasAttributes() || guide.hasAttributes()) morphAttributes(node, guide);
		if (node.hasChildNodes() || guide.hasChildNodes()) morphChildNodes(node, guide, idMap);
	} else node.replaceWith(guide.cloneNode(true));
}

function morphAttributes(elem: Element, guide: Element): void {
	// Remove any excess attributes from the element that aren’t present in the guide.
	for (const { name } of elem.attributes) guide.hasAttribute(name) || elem.removeAttribute(name);

	// Copy attributes from the guide to the element, if they don’t already match.
	for (const { name, value } of guide.attributes) elem.getAttribute(name) === value || elem.setAttribute(name, value);

	// For certain types of elements, we need to do some extra work to ensure the element’s state matches the guide’s state.
	if (isInput(elem) && isInput(guide) && elem.value !== guide.value) elem.value = guide.value;
	else if (isOption(elem) && isOption(guide) && elem.selected !== guide.selected) elem.selected = guide.selected;
	else if (isTextArea(elem) && isTextArea(guide) && elem.value !== guide.value) elem.value = guide.value;
}

// Iterates over the child nodes of the guide element, morphing the main element’s child nodes to match.
function morphChildNodes(elem: Element, guide: Element, idMap: IdMap): void {
	const childNodes = [...elem.childNodes];
	const guideChildNodes = [...guide.childNodes];

	for (let i = 0; i < guideChildNodes.length; i++) {
		const child = childNodes.at(i);
		const guideChild = guideChildNodes.at(i);

		if (child && guideChild) morphChildNode(child, guideChild, elem, idMap);
		else if (guideChild) elem.appendChild(guideChild.cloneNode(true));
		else if (child) child.remove();
	}

	// Remove any excess child nodes from the main element. This is separate because
	// the loop above might modify the length of the main element’s child nodes.
	while (elem.childNodes.length > guide.childNodes.length) elem.lastChild?.remove();
}

function morphChildNode(child: ChildNode, guide: ChildNode, parent: Element, idMap: IdMap): void {
	if (isElement(child) && isElement(guide)) morphChildElement(child, guide, parent, idMap);
	else morphNodes(child, guide, idMap);
}

function morphChildElement(child: Element, guide: Element, parent: Element, idMap: IdMap): void {
	const guideIdSet = idMap.get(guide);

	// Generate the array in advance of the loop
	const guideSetArray = guideIdSet ? [...guideIdSet] : [];

	let currentNode: ChildNode | null = child;
	let nextMatchByTagName: ChildNode | null = null;

	// Try find a match by idSet, while also looking out for the next best match by tagName.
	while (currentNode) {
		if (isElement(currentNode)) {
			if (currentNode.id === guide.id) {
				return morphNodes(currentNode, guide, idMap, child, parent);
			} else if (currentNode.id !== "") {
				const currentIdSet = idMap.get(currentNode);

				if (currentIdSet && guideSetArray.some((it) => currentIdSet.has(it))) {
					return morphNodes(currentNode, guide, idMap, child, parent);
				}
			} else if (!nextMatchByTagName && currentNode.tagName === guide.tagName) {
				nextMatchByTagName = currentNode;
			}
		}

		currentNode = currentNode.nextSibling;
	}

	if (nextMatchByTagName) morphNodes(nextMatchByTagName, guide, idMap, child, parent);
	else child.replaceWith(guide.cloneNode(true));
}

// We cannot use `instanceof` when nodes might be from different documents,
// so we use type guards instead. This keeps TypeScript happy, while doing
// the necessary checks at runtime.

function isText(node: Node): node is Text {
	return node.nodeType === Node.TEXT_NODE;
}

function isElement(node: Node): node is Element {
	return node.nodeType === Node.ELEMENT_NODE;
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
	return (
		node.nodeType === Node.ELEMENT_NODE ||
		node.nodeType === Node.DOCUMENT_NODE ||
		node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
	);
}
