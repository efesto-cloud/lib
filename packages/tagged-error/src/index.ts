import type { StandardSchemaV1 } from "@standard-schema/spec";

export type AnyTaggedError = Error & { readonly _tag: string };

export type TagHandlers<Self extends { readonly _tag: string }, R> = {
    [K in Self["_tag"]]: (error: Extract<Self, { readonly _tag: K }>) => R;
};

const dispatch = <R>(tag: string, handlers: unknown, arg: unknown): R =>
    (handlers as Record<string, (a: unknown) => R>)[tag](arg);

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
        return dispatch(this._tag, handlers, this);
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

export type PartialTagHandlers<Self extends { readonly _tag: string }> =
    Partial<TagHandlers<Self, unknown>> & {
        otherwise: (error: Self) => unknown;
    };

export function matchError<
    Self extends AnyTaggedError,
    H extends TagHandlers<Self, unknown>,
>(
    error: Self,
    handlers: H & Record<Exclude<keyof H, Self["_tag"]>, never>,
): ReturnType<H[keyof H]> {
    return dispatch(error._tag, handlers, error);
}

export function matchErrorPartial<
    Self extends AnyTaggedError,
    H extends PartialTagHandlers<Self>,
>(error: Self, handlers: H): ReturnType<NonNullable<H[keyof H]>> {
    const table = handlers as unknown as Record<
        string,
        ((e: Self) => ReturnType<NonNullable<H[keyof H]>>) | undefined
    >;
    const handler = table[error._tag] ?? table.otherwise;
    if (handler === undefined) {
        throw new TypeError(`No handler for tag "${error._tag}"`);
    }
    return handler(error);
}

const RESERVED = new Set([
    "_tag",
    "name",
    "message",
    "cause",
    "stack",
    "__proto__",
]);

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
                // I props possono arrivare da JSON.parse su dati non fidati:
                // `__proto__` e una proprieta *propria* del risultato e
                // un'assegnazione semplice ne invocherebbe il setter su
                // Object.prototype, sostituendo il prototype dell'istanza.
                // Regola: mai fare shadowing di qualcosa raggiungibile sul
                // prototype, e assegnare sempre con defineProperty.
                const proto = Object.getPrototypeOf(this);
                for (const [k, v] of Object.entries(props)) {
                    if (RESERVED.has(k) || k in proto) continue;
                    Object.defineProperty(this, k, {
                        value: v,
                        writable: true,
                        enumerable: true,
                        configurable: true,
                    });
                }
            }
        }

        static is(u: unknown): u is Impl {
            return u instanceof Error && (u as { _tag?: unknown })._tag === tag;
        }
    }
    return Impl as unknown as TaggedErrorCtor<Tag>;
}

export type AnyTaggedErrorClass = {
    // biome-ignore lint/suspicious/noExplicitAny: deve accettare qualunque forma concreta di props
    new (...args: any[]): AnyTaggedError;
    readonly _tag: string;
};

export function taggedErrorSchema<C extends readonly AnyTaggedErrorClass[]>(
    ...classes: C
): StandardSchemaV1<unknown, InstanceType<C[number]>> {
    const byTag = new Map<string, AnyTaggedErrorClass>(
        classes.map((c) => [c._tag, c]),
    );
    return {
        "~standard": {
            version: 1,
            vendor: "efesto-cloud",
            validate: (value: unknown) => {
                if (
                    typeof value !== "object" ||
                    value === null ||
                    Array.isArray(value)
                ) {
                    return { issues: [{ message: "Expected an object" }] };
                }
                const tag = (value as { _tag?: unknown })._tag;
                if (typeof tag !== "string") {
                    return {
                        issues: [{ message: "Missing `_tag`", path: ["_tag"] }],
                    };
                }
                const Cls = byTag.get(tag);
                if (Cls === undefined) {
                    return {
                        issues: [
                            {
                                message: `Unknown error tag "${tag}"`,
                                path: ["_tag"],
                            },
                        ],
                    };
                }
                return {
                    value: new Cls(
                        value as Record<string, unknown>,
                    ) as InstanceType<C[number]>,
                };
            },
        },
    };
}
