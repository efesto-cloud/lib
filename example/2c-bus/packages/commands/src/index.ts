import { Forbidden, Unauthenticated } from "@expenses/core/client";
import { Result } from "better-result";
import { z } from "zod";
import { type ErrorClass, InternalError, InvalidInput } from "./command.js";
import * as expenses from "./expenses.js";

export const commands = { ...expenses };

export type Commands = typeof commands;
export type CommandName = keyof Commands;
export type CommandInput<K extends CommandName> = z.output<
    Commands[K]["input"]
>;
export type CommandOutput<K extends CommandName> = z.output<
    Commands[K]["output"]
>;

/** What any command can answer with, besides its own errors. */
export const busErrors = [
    Unauthenticated,
    Forbidden,
    InvalidInput,
    InternalError,
] as const;
export type BusError = InstanceType<(typeof busErrors)[number]>;

export type CommandError<K extends CommandName> =
    | InstanceType<Commands[K]["errors"][number]>
    | BusError;
export type CommandResult<K extends CommandName> = Result<
    CommandOutput<K>,
    CommandError<K>
>;

/** The only way to call the application, whatever the channel. */
export interface Bus {
    dispatch<K extends CommandName>(
        name: K,
        input: CommandInput<K>,
    ): Promise<CommandResult<K>>;
}

/** Every error a command may answer with: its own and the bus's. */
export function declaredErrors(name: CommandName): readonly ErrorClass[] {
    return [...commands[name].errors, ...busErrors];
}

/** How a command's result travels as JSON and comes back as class instances. */
export function resultCodec(
    name: CommandName,
): z.ZodType<Result<unknown, unknown>, unknown> {
    const [first, ...rest] = declaredErrors(name).map((error) => error.codec());
    const wire = z.discriminatedUnion("status", [
        z.object({ status: z.literal("ok"), value: commands[name].output }),
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

export {
    type Command,
    command,
    type ErrorClass,
    InternalError,
    InvalidInput,
} from "./command.js";
