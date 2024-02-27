type MorphStyle = "innerHTML" | "outerHTML";
type AttributeMutationType = "updated" | "removed";
type HeadMode = "merge" | "morph";
interface Options {
	morphStyle?: MorphStyle;
	ignoreActiveValue?: boolean;
	head?: HeadMode;
	callbacks?: Callbacks;
}
interface Callbacks {
	beforeNodeAdded?: (node: Node) => boolean;
	afterNodeAdded?: (node: Node) => void;
	beforeNodeMorphed?: (oldNode: Node, newNode: Node) => boolean;
	afterNodeMorphed?: (oldNode: Node, newNode: Node) => void;
	beforeNodeRemoved?: (node: Node) => boolean;
	afterNodeRemoved?: (node: Node) => void;
	beforeAttributeUpdated?: (attributeName: string, node: Node, mutationType: AttributeMutationType) => boolean;
}
export declare class Idiomorph {
	static morph(node: ChildNode, referenceNode: ChildNode, options?: Options): void;
}
export {};
