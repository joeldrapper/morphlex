export function morph(node, reference, options = {}) {
	new Morph(options).morph(node, reference);
}
class Morph {
	#idMap;
	#sensivityMap;
	#options;
	constructor(options = {}) {
		this.#options = options;
		this.#idMap = new WeakMap();
		this.#sensivityMap = new WeakMap();
	}
	morph(node, reference) {
		const readonlyReference = reference;
		if (isParentNode(node) && isParentNode(readonlyReference)) {
			this.#populateIdSets(node);
			this.#populateIdSets(readonlyReference);
			this.#populateSensivityMap(node);
		}
		this.#morphNode(node, readonlyReference);
	}
	// TODO: Get rid of this
	get context() {
		return { ...this.#options, idMap: this.#idMap, sensitivityMap: this.#sensivityMap };
	}
	#populateSensivityMap(node) {
		const sensitiveElements = node.querySelectorAll("iframe,video,object,embed,audio,input,textarea,canvas");
		for (const sensitiveElement of sensitiveElements) {
			let sensivity = 0;
			if (isInput(sensitiveElement) || isTextArea(sensitiveElement)) {
				sensivity += 1;
				if (sensitiveElement.value !== sensitiveElement.defaultValue) sensivity += 1;
				if (sensitiveElement === document.activeElement) sensivity += 1;
			} else {
				sensivity += 3;
				if (sensitiveElement instanceof HTMLMediaElement && !sensitiveElement.ended) {
					if (!sensitiveElement.paused) sensivity += 1;
					if (sensitiveElement.currentTime > 0) sensivity += 1;
				}
			}
			let current = sensitiveElement;
			while (current) {
				this.#sensivityMap.set(current, (this.#sensivityMap.get(current) || 0) + sensivity);
				if (current === node) break;
				current = current.parentElement;
			}
		}
	}
	// For each node with an ID, push that ID into the IdSet on the IdMap, for each of its parent elements.
	#populateIdSets(node) {
		const elementsWithIds = node.querySelectorAll("[id]");
		for (const elementWithId of elementsWithIds) {
			const id = elementWithId.id;
			// Ignore empty IDs
			if (id === "") continue;
			let current = elementWithId;
			while (current) {
				const idSet = this.#idMap.get(current);
				idSet ? idSet.add(id) : this.#idMap.set(current, new Set([id]));
				if (current === node) break;
				current = current.parentElement;
			}
		}
	}
	// This is where we actually morph the nodes. The `morph` function (above) exists only to set up the `idMap`.
	#morphNode(node, ref) {
		if (!(this.#options.beforeNodeMorphed?.({ node, referenceNode: ref }) ?? true)) return;
		if (isElement(node) && isElement(ref) && node.tagName === ref.tagName) {
			if (node.hasAttributes() || ref.hasAttributes()) this.#morphAttributes(node, ref);
			if (isHead(node) && isHead(ref)) {
				const refChildNodes = new Map();
				for (const child of ref.children) refChildNodes.set(child.outerHTML, child);
				for (const child of node.children) {
					const key = child.outerHTML;
					const refChild = refChildNodes.get(key);
					refChild ? refChildNodes.delete(key) : this.#removeNode(child);
				}
				for (const refChild of refChildNodes.values()) this.#appendChild(node, refChild.cloneNode(true));
			} else if (node.hasChildNodes() || ref.hasChildNodes()) this.#morphChildNodes(node, ref);
		} else {
			if (isText(node) && isText(ref)) {
				this.#updateProperty(node, "textContent", ref.textContent);
			} else if (isComment(node) && isComment(ref)) {
				this.#updateProperty(node, "nodeValue", ref.nodeValue);
			} else this.#replaceNode(node, ref.cloneNode(true));
		}
		this.#options.afterNodeMorphed?.({ node });
	}
	#morphAttributes(element, ref) {
		// Remove any excess attributes from the element that aren’t present in the reference.
		for (const { name, value } of element.attributes) {
			if (
				!ref.hasAttribute(name) &&
				(this.#options.beforeAttributeUpdated?.({ element, attributeName: name, newValue: null }) ?? true)
			) {
				element.removeAttribute(name);
				this.#options.afterAttributeUpdated?.({ element, attributeName: name, previousValue: value });
			}
		}
		// Copy attributes from the reference to the element, if they don’t already match.
		for (const { name, value } of ref.attributes) {
			const previousValue = element.getAttribute(name);
			if (
				previousValue !== value &&
				(this.#options.beforeAttributeUpdated?.({ element, attributeName: name, newValue: value }) ?? true)
			) {
				element.setAttribute(name, value);
				this.#options.afterAttributeUpdated?.({ element, attributeName: name, previousValue });
			}
		}
		// For certain types of elements, we need to do some extra work to ensure
		// the element’s state matches the reference elements’ state.
		if (isInput(element) && isInput(ref)) {
			this.#updateProperty(element, "checked", ref.checked);
			this.#updateProperty(element, "disabled", ref.disabled);
			this.#updateProperty(element, "indeterminate", ref.indeterminate);
			if (
				element.type !== "file" &&
				!(this.#options.ignoreActiveValue && document.activeElement === element) &&
				!(this.#options.preserveModifiedValues && element.value !== element.defaultValue)
			)
				this.#updateProperty(element, "value", ref.value);
		} else if (isOption(element) && isOption(ref)) this.#updateProperty(element, "selected", ref.selected);
		else if (isTextArea(element) && isTextArea(ref)) {
			this.#updateProperty(element, "value", ref.value);
			// TODO: Do we need this? If so, how do we integrate with the callback?
			const text = element.firstChild;
			if (text && isText(text)) this.#updateProperty(text, "textContent", ref.value);
		}
	}
	// Iterates over the child nodes of the reference element, morphing the main element’s child nodes to match.
	#morphChildNodes(element, ref) {
		const childNodes = element.childNodes;
		const refChildNodes = ref.childNodes;
		for (let i = 0; i < refChildNodes.length; i++) {
			const child = childNodes[i];
			const refChild = refChildNodes[i]; //as ReadonlyNode<ChildNode> | null;
			if (child && refChild) {
				if (isElement(child) && isElement(refChild)) this.#morphChildElement(child, refChild, element);
				else this.#morphNode(child, refChild);
			} else if (refChild) {
				this.#appendChild(element, refChild.cloneNode(true));
			} else if (child) {
				this.#removeNode(child);
			}
		}
		// Clean up any excess nodes that may be left over
		while (childNodes.length > refChildNodes.length) {
			const child = element.lastChild;
			if (child) this.#removeNode(child);
		}
	}
	#morphChildElement(child, ref, parent) {
		const refIdSet = this.#idMap.get(ref);
		// Generate the array in advance of the loop
		const refSetArray = refIdSet ? [...refIdSet] : [];
		let currentNode = child;
		let nextMatchByTagName = null;
		// Try find a match by idSet, while also looking out for the next best match by tagName.
		while (currentNode) {
			if (isElement(currentNode)) {
				const id = currentNode.id;
				if (!nextMatchByTagName && currentNode.tagName === ref.tagName) {
					nextMatchByTagName = currentNode;
				}
				if (id !== "") {
					if (id === ref.id) {
						this.#insertBefore(parent, currentNode, child);
						return this.#morphNode(currentNode, ref);
					} else {
						const currentIdSet = this.#idMap.get(currentNode);
						if (currentIdSet && refSetArray.some((it) => currentIdSet.has(it))) {
							this.#insertBefore(parent, currentNode, child);
							return this.#morphNode(currentNode, ref);
						}
					}
				}
			}
			currentNode = currentNode.nextSibling;
		}
		if (nextMatchByTagName) {
			this.#insertBefore(parent, nextMatchByTagName, child);
			this.#morphNode(nextMatchByTagName, ref);
		} else {
			// TODO: this is missing an added callback
			this.#insertBefore(parent, ref.cloneNode(true), child);
		}
	}
	#updateProperty(node, propertyName, newValue) {
		const previousValue = node[propertyName];
		if (previousValue !== newValue && (this.#options.beforePropertyUpdated?.({ node, propertyName, newValue }) ?? true)) {
			node[propertyName] = newValue;
			this.#options.afterPropertyUpdated?.({ node, propertyName, previousValue });
		}
	}
	#replaceNode(node, newNode) {
		if (
			(this.#options.beforeNodeRemoved?.({ oldNode: node }) ?? true) &&
			(this.#options.beforeNodeAdded?.({ newNode, parentNode: node.parentNode }) ?? true)
		) {
			node.replaceWith(newNode);
			this.#options.afterNodeAdded?.({ newNode });
			this.#options.afterNodeRemoved?.({ oldNode: node });
		}
	}
	#insertBefore(parent, node, insertionPoint) {
		if (node === insertionPoint) return;
		if (isElement(node)) {
			const sensitivity = this.#sensivityMap.get(node) ?? 0;
			if (sensitivity > 0) {
				let previousNode = node.previousSibling;
				while (previousNode) {
					const previousNodeSensitivity = this.#sensivityMap.get(previousNode) ?? 0;
					if (previousNodeSensitivity < sensitivity) {
						parent.insertBefore(previousNode, node.nextSibling);
						if (previousNode === insertionPoint) return;
						previousNode = node.previousSibling;
					} else {
						break;
					}
				}
			}
		}
		parent.insertBefore(node, insertionPoint);
	}
	#appendChild(node, newNode) {
		if (this.#options.beforeNodeAdded?.({ newNode, parentNode: node }) ?? true) {
			node.appendChild(newNode);
			this.#options.afterNodeAdded?.({ newNode });
		}
	}
	#removeNode(node) {
		if (this.#options.beforeNodeRemoved?.({ oldNode: node }) ?? true) {
			node.remove();
			this.#options.afterNodeRemoved?.({ oldNode: node });
		}
	}
}
function isText(node) {
	return node.nodeType === 3;
}
function isComment(node) {
	return node.nodeType === 8;
}
function isElement(node) {
	return node.nodeType === 1;
}
function isInput(element) {
	return element.localName === "input";
}
function isOption(element) {
	return element.localName === "option";
}
function isTextArea(element) {
	return element.localName === "textarea";
}
function isHead(element) {
	return element.localName === "head";
}
function isParentNode(node) {
	return node.nodeType === 1 || node.nodeType === 9 || node.nodeType === 11;
}
//# sourceMappingURL=morphlex.js.map
