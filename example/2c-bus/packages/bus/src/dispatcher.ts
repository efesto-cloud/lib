import type IUseCase from "@efesto-cloud/usecase";
import {
    type CommandName,
    commands,
    declaredErrors,
    InternalError,
    InvalidInput,
} from "@expenses/commands";
import type { IAuthorizer, IIdentifier, ResolveUseCase } from "@expenses/core";
import { Result } from "better-result";
import { z } from "zod";
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
            if (Result.isError(actor)) return actor;

            if (!Object.hasOwn(commands, name)) {
                return Result.err(
                    new InvalidInput({ issue: `Unknown command ${name}` }),
                );
            }
            const command = commands[name as CommandName];
            const input = (command.input as z.ZodType).safeParse(rawInput);
            if (!input.success)
                return Result.err(
                    new InvalidInput({ issue: z.prettifyError(input.error) }),
                );

            const handler = handlers[name as CommandName];
            const call: Call = {
                command: name as CommandName,
                useCase: handler.useCase,
                input: handler.toUseCase(input.data as never),
                context: { actor: actor.value },
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

            const errors = declaredErrors(name as CommandName);
            const declared = (error: unknown) =>
                errors.some((Class) => Class.is(error));
            try {
                const outcome = await run();
                if (Result.isError(outcome) && !declared(outcome.error)) {
                    console.error(
                        `[bus] ${name}: undeclared error`,
                        outcome.error,
                    );
                    return Result.err(new InternalError());
                }
                return outcome;
            } catch (error) {
                console.error(`[bus] ${name}:`, error);
                return Result.err(new InternalError());
            }
        },
    };
}
