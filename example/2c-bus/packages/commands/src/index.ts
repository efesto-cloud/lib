import { Forbidden, Unauthenticated } from "@expenses/core/client";
import { type Result, Schema } from "effect";
import { InternalError, InvalidInput } from "./command.js";
import * as expenses from "./expenses.js";

export const commands = { ...expenses };

export type Commands = typeof commands;
export type CommandName = keyof Commands;
export type CommandInput<K extends CommandName> = Commands[K]["input"]["Type"];
export type CommandOutput<K extends CommandName> =
    Commands[K]["output"]["Type"];

/** What any command can answer with, besides its own errors. */
export const BusError = Schema.Union([
    Unauthenticated,
    Forbidden,
    InvalidInput,
    InternalError,
]);
export type BusError = typeof BusError.Type;

export type CommandError<K extends CommandName> =
    | Commands[K]["errors"]["Type"]
    | BusError;
export type CommandResult<K extends CommandName> = Result.Result<
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

/** How a command's result travels as JSON and comes back as class instances. */
export function resultCodec(name: CommandName) {
    const command = commands[name];
    return Schema.toCodecJson(
        Schema.Result(command.output, Schema.Union([command.errors, BusError])),
    );
}

export {
    type AnySchema,
    type Command,
    command,
    InternalError,
    InvalidInput,
} from "./command.js";
