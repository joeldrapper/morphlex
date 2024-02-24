export function morph(node, guide) {
    const idMap = new Map();
    if (isElement(node) && isElement(guide)) {
        populateIdMapForNode(node, idMap);
        populateIdMapForNode(guide, idMap);
    }
    morphNodes(node, guide, idMap);
}
function morphNodes(node, guide, idMap, insertBefore, parent) {
    if (parent && insertBefore && insertBefore !== node)
        parent.insertBefore(guide, insertBefore);
    if (isText(node) && isText(guide)) {
        if (node.textContent !== guide.textContent)
            node.textContent = guide.textContent;
    }
    else if (isElement(node) && isElement(guide)) {
        if (node.tagName === guide.tagName) {
            if (node.hasAttributes() || guide.hasAttributes())
                morphAttributes(node, guide);
            if (node.hasChildNodes() || guide.hasChildNodes())
                morphChildNodes(node, guide, idMap);
        }
        else
            node.replaceWith(guide.cloneNode(true));
    }
    else
        throw new Error(`Cannot morph from ${node.constructor.name}, to ${guide.constructor.name}`);
}
function morphAttributes(elem, guide) {
    for (const { name } of elem.attributes)
        guide.hasAttribute(name) || elem.removeAttribute(name);
    for (const { name, value } of guide.attributes)
        elem.getAttribute(name) !== value && elem.setAttribute(name, value);
    if (isInput(elem) && isInput(guide) && elem.value !== guide.value)
        elem.value = guide.value;
    else if (isOption(elem) && isOption(guide) && elem.selected !== guide.selected)
        elem.selected = guide.selected;
    else if (isTextArea(elem) && isTextArea(guide) && elem.value !== guide.value)
        elem.value = guide.value;
}
function morphChildNodes(elem, guide, idMap) {
    var _a;
    for (let i = 0; i < guide.childNodes.length; i++) {
        const childA = [...elem.childNodes].at(i);
        const childB = [...guide.childNodes].at(i);
        if (childA && childB)
            morphChildNode(childA, childB, idMap, elem);
        else if (childB)
            elem.appendChild(childB.cloneNode(true));
    }
    while (elem.childNodes.length > guide.childNodes.length)
        (_a = elem.lastChild) === null || _a === void 0 ? void 0 : _a.remove();
}
function morphChildNode(child, guide, idMap, parent) {
    if (isElement(child) && isElement(guide)) {
        let current = child;
        let nextBestMatch = null;
        while (current && isElement(current)) {
            if (current.id !== "" && current.id === guide.id) {
                morphNodes(current, guide, idMap, child, parent);
                break;
            }
            else {
                const setA = idMap.get(current);
                const setB = idMap.get(guide);
                if (setA && setB && hasItemInCommon(setA, setB)) {
                    return morphNodes(current, guide, idMap, child, parent);
                }
                else if (!nextBestMatch && current.tagName === guide.tagName) {
                    nextBestMatch = current;
                }
            }
            current = current.nextSibling;
        }
        if (nextBestMatch)
            morphNodes(nextBestMatch, guide, idMap, child, parent);
        else
            child.replaceWith(guide.cloneNode(true));
    }
    else
        morphNodes(child, guide, idMap);
}
function populateIdMapForNode(node, idMap) {
    const elementsWithIds = node.querySelectorAll("[id]");
    for (const elementWithId of elementsWithIds) {
        const id = elementWithId.id;
        if (id === "")
            continue;
        let current = elementWithId;
        while (current) {
            const idSet = idMap.get(current);
            idSet ? idSet.add(id) : idMap.set(current, new Set([id]));
            if (current === elementWithId)
                break;
            current = current.parentElement;
        }
    }
}
function hasItemInCommon(a, b) {
    return [...a].some((item) => b.has(item));
}
function isElement(node) {
    return node.nodeType === 1;
}
function isText(node) {
    return node.nodeType === 3;
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
//# sourceMappingURL=morphlite.js.map