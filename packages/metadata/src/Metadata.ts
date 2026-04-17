import type IMetadata from "./IMetadata.js";

export default class Metadata<K extends string = string> {
    private readonly props: IMetadata<K>;

    constructor(props: IMetadata<K>) {
        this.props = props;
    }

    set(key: K, value: string) {
        this.props[key] = value;
        return this;
    }

    get(key: K): string | undefined {
        return this.props[key];
    }

    remove(key: K) {
        delete this.props[key];
        return this;
    }

    has(key: K): boolean {
        return key in this.props;
    }

    add(...entry: [K, string][]) {
        for (const [key, value] of entry) {
            this.props[key] = value;
        }
    }

    entries(): [K, string][] {
        return Object.entries(this.props) as [K, string][];
    }

    static fromEntries<K extends string = string>(entries: [K, string][]) {
        const obj: IMetadata<K> = {};
        for (const [key, value] of entries) {
            obj[key] = value;
        }
        return new Metadata(obj);
    }

    static create<K extends string = string>(
        obj: IMetadata<K> = {},
    ): Metadata<K> {
        return Metadata.fromEntries(Object.entries(obj) as [K, string][]);
    }

    toDTO() {
        return { ...this.props };
    }
}
