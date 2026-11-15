import { data } from "react-router";
import type { z } from "zod";

/** Il dato grezzo di una richiesta secondo lo schema dello use case, o un 400. */
export function parseInput<S extends z.ZodType>(
    schema: S,
    value: unknown,
): z.output<S> {
    const input = schema.safeParse(value);
    if (!input.success) throw data("Richiesta non valida", { status: 400 });
    return input.data;
}
