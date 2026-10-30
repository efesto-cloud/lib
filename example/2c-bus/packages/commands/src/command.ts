import { Schema } from "effect";

// biome-ignore lint/suspicious/noExplicitAny: any schema whose decoding needs no services
export type AnySchema = Schema.Codec<any, any, never, never>;

/**
 * One exposed operation: what goes in, what comes out, which named errors
 * it can answer with. The client can read all of it; only the bus enforces it.
 */
export type Command<
    I extends AnySchema,
    O extends AnySchema,
    E extends AnySchema,
> = {
    readonly kind: "query" | "mutation";
    readonly description: string;
    readonly input: I;
    readonly output: O;
    readonly errors: E;
};

export function command<
    I extends AnySchema,
    O extends AnySchema,
    E extends AnySchema,
>(definition: Command<I, O, E>): Command<I, O, E> {
    return definition;
}

/** Input that does not match the command's schema. */
export class InvalidInput extends Schema.TaggedError<InvalidInput>()(
    "InvalidInput",
    {
        issue: Schema.String,
    },
) {}

/** Anything the command does not declare. No details cross the bus. */
export class InternalError extends Schema.TaggedError<InternalError>()(
    "InternalError",
    {},
) {}
