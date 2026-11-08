import { Result } from "better-result";
import { z } from "zod";
import Forbidden from "./errors/Forbidden.js";
import InternalError from "./errors/InternalError.js";
import InvalidInput from "./errors/InvalidInput.js";
import Unauthenticated from "./errors/Unauthenticated.js";
import { type UseCaseInput, type UseCaseKey, useCases } from "./registry.js";
import type { ErrorClass, ErrorOf, OutputOf } from "./useCase.js";

/** What any call can answer with, besides the use case's own errors. */
export const apiErrors = [
    Unauthenticated,
    Forbidden,
    InvalidInput,
    InternalError,
] as const;
export type ApiError = InstanceType<(typeof apiErrors)[number]>;

export type CallResult<K extends UseCaseKey> = Result<
    OutputOf<(typeof useCases)[K]>,
    ErrorOf<(typeof useCases)[K]> | ApiError
>;

/** The only way to call the application, whatever the channel. */
export interface Api {
    dispatch<K extends UseCaseKey>(
        name: K,
        input: UseCaseInput<K>,
    ): Promise<CallResult<K>>;
}

/** Every error a use case may answer with across the boundary. */
export function declaredErrors(name: UseCaseKey): readonly ErrorClass[] {
    return [...useCases[name].errors, ...apiErrors];
}

/** How a result travels as JSON and comes back as class instances. */
export function resultCodec(
    name: UseCaseKey,
): z.ZodType<Result<unknown, unknown>, unknown> {
    const [first, ...rest] = declaredErrors(name).map((error) => error.codec());
    const wire = z.discriminatedUnion("status", [
        z.object({ status: z.literal("ok"), value: useCases[name].output }),
        z.object({
            status: z.literal("error"),
            error: z.union([first as z.ZodType, ...rest]),
        }),
    ]);
    return z.codec(
        wire,
        z.custom<Result<unknown, unknown>>(
            (value) =>
                Result.isOk(value as Result<unknown, unknown>) ||
                Result.isError(value as Result<unknown, unknown>),
        ),
        {
            decode: (w) =>
                w.status === "ok" ? Result.ok(w.value) : Result.err(w.error),
            encode: (r) =>
                (Result.isOk(r)
                    ? { status: "ok", value: r.value }
                    : { status: "error", error: r.error }) as never,
        },
    );
}
