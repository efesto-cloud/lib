import type IUseCase from "@efesto-cloud/usecase";
import type { AnyTaggedError, Result } from "better-result";
import type { z } from "zod";
import type { MemberDto } from "./dto/MemberDto.js";

/** What every call carries besides the input. */
export type ExecutionContext = {
    /** Who performs the operation. There are no anonymous calls. */
    actor: MemberDto;
};

/** A named error class that knows how to travel (see `taggedError`). */
export type ErrorClass = {
    new (...args: never[]): AnyTaggedError;
    is(value: unknown): boolean;
    codec(): z.ZodType;
};

/**
 * One use case as the outside sees it: what goes in, what comes out, which
 * named errors it can answer with. The interface is derived from it, so input,
 * output and errors are declared once.
 */
export type UseCaseSpec<
    I extends z.ZodType = z.ZodType,
    O extends z.ZodType = z.ZodType,
    E extends readonly ErrorClass[] = readonly ErrorClass[],
> = {
    readonly kind: "query" | "mutation";
    readonly description: string;
    readonly input: I;
    readonly output: O;
    readonly errors: E;
};

export function useCase<
    I extends z.ZodType,
    O extends z.ZodType,
    const E extends readonly ErrorClass[],
>(spec: UseCaseSpec<I, O, E>): UseCaseSpec<I, O, E> {
    return spec;
}

export type InputOf<S extends UseCaseSpec> = z.output<S["input"]>;
export type OutputOf<S extends UseCaseSpec> = z.output<S["output"]>;
export type ErrorOf<S extends UseCaseSpec> = InstanceType<S["errors"][number]>;

/** The interface the core implements. */
export type UseCaseOf<S extends UseCaseSpec> = IUseCase<
    InputOf<S>,
    Result<OutputOf<S>, ErrorOf<S>>,
    ExecutionContext
>;
