import type { ExecutionContext } from "@itec/contract/useCase";
import { ContainerModule, inject, injectable } from "inversify";
import type Policy from "~/auth/Policy.js";
import type { PolicyClass } from "~/auth/Policy.js";

/**
 * Un'implementazione per ogni use case di `R`: se ne manca una, o non
 * rispetta la sua interfaccia, non compila.
 */
export type UseCaseImplementations<R> = {
    [K in keyof R]: new (
        ...args: never[]
    ) => R[K];
};

type InputOf<U> = U extends {
    execute(input: infer I, ...rest: never[]): unknown;
}
    ? I
    : never;

/** Una policy per ogni use case di `R`: se ne manca una, non compila. */
export type Policies<R> = { [K in keyof R]: PolicyClass<InputOf<R[K]>> };

interface Executable {
    execute(input: unknown, ctx: ExecutionContext): Promise<unknown>;
}

/**
 * Lo use case di `key` dietro la sua policy: è quello che dà il resolver.
 * Sotto `key` resta lo use case nudo, per chi se lo fa iniettare.
 */
export const guardedId = (key: string) => Symbol.for(`Guarded:${key}`);

/**
 * Si fa iniettare lo use case e la sua policy, quindi li risolve nello stesso
 * request scope: la stessa Unit of Work.
 */
function guarded(key: string, policyId: symbol) {
    @injectable()
    class Guarded {
        constructor(
            @inject(key) private readonly useCase: Executable,
            @inject(policyId) private readonly policy: Policy<unknown>,
        ) {}

        async execute(input: unknown, ctx: ExecutionContext) {
            const allowed = await this.policy.check(input, ctx);
            if (allowed.isErr()) return allowed;
            return this.useCase.execute(input, ctx);
        }
    }
    return Guarded;
}

/**
 * Lega ogni use case alla sua chiave del registro, e dietro la sua policy a
 * `guardedId(key)`, una istanza per richiesta.
 */
export function useCaseModule<R>(
    implementations: UseCaseImplementations<R>,
    policies: Policies<R>,
): ContainerModule {
    return new ContainerModule((bind) => {
        for (const key in implementations) {
            const policyId = Symbol(`Policy:${key}`);
            bind(key).to(implementations[key]).inRequestScope();
            bind(policyId).to(policies[key]).inRequestScope();
            bind(guardedId(key)).to(guarded(key, policyId)).inRequestScope();
        }
    });
}
