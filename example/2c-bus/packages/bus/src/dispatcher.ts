import type IUseCase from "@efesto-cloud/usecase";
import {
    BusError,
    type CommandName,
    commands,
    InternalError,
    InvalidInput,
} from "@expenses/commands";
import type { IAuthorizer, IIdentifier, ResolveUseCase } from "@expenses/core";
import { Result, Schema } from "effect";
import { handlers } from "./handlers/index.js";
import { policy } from "./middleware/policy.js";
import type { Call, Middleware, Outcome } from "./middleware/types.js";

export type BusCore = {
    resolveUseCase: ResolveUseCase;
    identifier: IIdentifier;
    authorizer: IAuthorizer;
};

export type Dispatcher = ReturnType<typeof createDispatcher>;

/**
 * Where every command arrives, whatever the channel: identify the actor,
 * validate the input, run the middleware (policy first), then the handler.
 */
export function createDispatcher(
    core: BusCore,
    options: { middleware?: Middleware[] } = {},
) {
    const chain = [policy(core.authorizer), ...(options.middleware ?? [])];

    return {
        async dispatch(
            name: string,
            rawInput: unknown,
            token: string | null,
        ): Promise<Outcome> {
            const actor = await core.identifier.identify(token);
            if (Result.isFailure(actor)) return actor;

            if (!Object.hasOwn(commands, name)) {
                return Result.fail(
                    new InvalidInput({ issue: `Unknown command ${name}` }),
                );
            }
            const command = commands[name as CommandName];
            const input = Schema.decodeUnknownResult(
                command.input as Schema.Codec<unknown>,
            )(rawInput);
            if (Result.isFailure(input))
                return Result.fail(
                    new InvalidInput({ issue: String(input.failure) }),
                );

            const handler = handlers[name as CommandName];
            const call: Call = {
                command: name as CommandName,
                useCase: handler.useCase,
                input: handler.toUseCase(input.success as never),
                context: { actor: actor.success },
            };
            const run = chain.reduceRight<() => Promise<Outcome>>(
                (next, middleware) => () => middleware(call, next),
                () =>
                    (
                        core.resolveUseCase(call.useCase) as IUseCase<
                            unknown,
                            Outcome
                        >
                    ).execute(call.input, call.context),
            );

            const declared = Schema.is(
                Schema.Union([command.errors, BusError]),
            );
            try {
                const outcome = await run();
                if (Result.isFailure(outcome) && !declared(outcome.failure)) {
                    console.error(
                        `[bus] ${name}: undeclared error`,
                        outcome.failure,
                    );
                    return Result.fail(new InternalError());
                }
                return outcome;
            } catch (error) {
                console.error(`[bus] ${name}:`, error);
                return Result.fail(new InternalError());
            }
        },
    };
}
