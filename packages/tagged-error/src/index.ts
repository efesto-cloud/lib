export type AnyTaggedError = Error & { readonly _tag: string };

export type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};

export abstract class TaggedErrorBase extends Error {
    abstract readonly _tag: string;

    toJSON(): Record<string, unknown> {
        const self = this as unknown as Record<string, unknown> & Error;
        return {
            ...self,
            _tag: self._tag,
            name: self.name,
            message: self.message,
            ...(self.cause !== undefined ? { cause: self.cause } : {}),
        };
    }

    match<
        Self extends { readonly _tag: string },
        H extends TagHandlers<Self, unknown>,
    >(
        this: Self,
        handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
    ): ReturnType<H[keyof H]> {
        const table = handlers as unknown as Record<
            string,
            (e: Self) => ReturnType<H[keyof H]>
        >;
        return table[this._tag](this);
    }
}

type CtorArgs<Props extends object> = object extends Props
    ? [props?: Props & ErrorOptions & { message?: string }]
    : [props: Props & ErrorOptions & { message?: string }];

export interface TaggedErrorCtor<Tag extends string> {
    new <Props extends object = object>(
        ...args: CtorArgs<Props>
    ): TaggedErrorBase &
        Readonly<Props> & { readonly _tag: Tag; readonly name: Tag };
    readonly _tag: Tag;
    is(u: unknown): u is TaggedErrorBase & { readonly _tag: Tag };
}

const RESERVED = new Set(["_tag", "name", "message", "cause", "stack"]);

export function TaggedError<Tag extends string>(
    tag: Tag,
): TaggedErrorCtor<Tag> {
    class Impl extends TaggedErrorBase {
        readonly _tag = tag;
        static readonly _tag = tag;

        constructor(props?: Record<string, unknown> & ErrorOptions) {
            const message = props?.message;
            const cause = props?.cause;
            super(
                typeof message === "string" ? message : undefined,
                cause !== undefined ? { cause } : undefined,
            );
            this.name = tag;
            if (props) {
                for (const [k, v] of Object.entries(props)) {
                    if (!RESERVED.has(k)) {
                        (this as unknown as Record<string, unknown>)[k] = v;
                    }
                }
            }
        }

        static is(u: unknown): u is Impl {
            return u instanceof Error && (u as { _tag?: unknown })._tag === tag;
        }
    }
    return Impl as unknown as TaggedErrorCtor<Tag>;
}
