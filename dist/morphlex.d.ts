type ObjectKey = string | number | symbol;
export interface Options {
	ignoreActiveValue?: boolean;
	preserveModifiedValues?: boolean;
	beforeNodeMorphed?: (node: Node, referenceNode: Node) => boolean;
	afterNodeMorphed?: (node: Node, referenceNode: Node) => void;
	beforeNodeAdded?: (node: Node) => boolean;
	afterNodeAdded?: (node: Node) => void;
	beforeNodeRemoved?: (node: Node) => boolean;
	afterNodeRemoved?: (node: Node) => void;
	beforeAttributeUpdated?: (element: Element, attributeName: string, newValue: string | null) => boolean;
	afterAttributeUpdated?: (element: Element, attributeName: string, previousValue: string | null) => void;
	beforePropertyUpdated?: (node: Node, propertyName: ObjectKey, newValue: unknown) => boolean;
	afterPropertyUpdated?: (node: Node, propertyName: ObjectKey, previousValue: unknown) => void;
}
export declare function morph(node: ChildNode, reference: ChildNode | string, options?: Options): void;
export {};
