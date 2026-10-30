import type IUseCase from "@efesto-cloud/usecase";
import type {
    CommandError,
    CommandInput,
    CommandName,
    CommandOutput,
} from "@expenses/commands";
import type { UseCaseInput, UseCaseKey, UseCaseRegistry } from "@expenses/core";
import type { Result } from "effect";

/** Turns a command into its use case. Knows nothing about who wraps it. */
export type Handler<K extends CommandName> = {
    readonly useCase: UseCaseKey;
    readonly toUseCase: (input: CommandInput<K>) => unknown;
};

type UseCaseResult<U extends UseCaseKey> =
    // biome-ignore lint/suspicious/noExplicitAny: only the result type matters here
    UseCaseRegistry[U] extends IUseCase<any, infer R> ? R : never;

/** Compiles only if what the use case returns is what the command declares. */
type Matches<K extends CommandName, U extends UseCaseKey> =
    UseCaseResult<U> extends Result.Result<CommandOutput<K>, CommandError<K>>
        ? unknown
        : { error: `${U} returns something ${K} does not declare` };

export function handler<K extends CommandName, U extends UseCaseKey>(
    _command: K,
    definition: {
        useCase: U;
        toUseCase: (input: CommandInput<K>) => UseCaseInput<U>;
    } & Matches<K, U>,
): Handler<K> {
    return definition;
}
