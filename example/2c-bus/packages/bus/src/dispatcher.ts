import type IUseCase from "@efesto-cloud/usecase";
import { declaredErrors } from "@expenses/contract/api";
import InternalError from "@expenses/contract/errors/InternalError";
import InvalidInput from "@expenses/contract/errors/InvalidInput";
import { type ResolveUseCase, useCases } from "@expenses/contract/registry";
import type IAuthorizer from "@expenses/core/auth/IAuthorizer";
import type IIdentifier from "@expenses/core/auth/IIdentifier";
import { Result } from "better-result";
import { z } from "zod";
import { policy } from "./middleware/policy.js";
import type { Call, Middleware, Outcome } from "./middleware/types.js";

export type BusCore = {
    resolveUseCase: ResolveUseCase;
    identifier: IIdentifier;
    authorizer: IAuthorizer;
};

export type Dispatcher = ReturnType<typeof createDispatcher>;

/**
 * Where every call arrives, whatever the channel: identify the actor,
 * validate the input, run the middleware (policy first), then the use case.
 * The name of the call is the key of the use case: there is no handler.
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

            if (!Object.hasOwn(useCases, name)) {
                return Result.err(
                    new InvalidInput({ issue: `Unknown use case ${name}` }),
                );
            }
            const key = name as keyof typeof useCases;
            const input = (useCases[key].input as z.ZodType).safeParse(
                rawInput,
            );
            if (!input.success)
                return Result.err(
                    new InvalidInput({ issue: z.prettifyError(input.error) }),
                );

            const call: Call = {
                useCase: key,
                input: input.data,
                context: { actor: actor.value },
            };
            const run = chain.reduceRight<() => Promise<Outcome>>(
                (next, middleware) => () => middleware(call, next),
                () =>
                    (
                        core.resolveUseCase(key) as IUseCase<
                            unknown,
                            Outcome,
                            Call["context"]
                        >
                    ).execute(call.input, call.context),
            );

            const errors = declaredErrors(key);
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
