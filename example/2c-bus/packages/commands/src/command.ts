import { taggedError } from "@expenses/core/client";
import type { AnyTaggedError } from "better-result";
import type { z } from "zod";
import { z as zod } from "zod";

/** A named error class that knows how to travel (see core `taggedError`). */
export type ErrorClass = {
    new (...args: never[]): AnyTaggedError;
    is(value: unknown): boolean;
    codec(): z.ZodType;
};

/**
 * One exposed operation: what goes in, what comes out, which named errors
 * it can answer with. The client can read all of it; only the bus enforces it.
 */
export type Command<
    I extends z.ZodType,
    O extends z.ZodType,
    E extends readonly ErrorClass[],
> = {
    readonly kind: "query" | "mutation";
    readonly description: string;
    readonly input: I;
    readonly output: O;
    readonly errors: E;
};

export function command<
    I extends z.ZodType,
    O extends z.ZodType,
    const E extends readonly ErrorClass[],
>(definition: Command<I, O, E>): Command<I, O, E> {
    return definition;
}

/** Input that does not match the command's schema. */
export class InvalidInput extends taggedError("InvalidInput", {
    issue: zod.string(),
}) {}

/** Anything the command does not declare. No details cross the bus. */
export class InternalError extends taggedError("InternalError", {}) {}
