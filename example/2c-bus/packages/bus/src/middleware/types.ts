import type { UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type { Result } from "better-result";

export type Call = {
    readonly useCase: UseCaseKey;
    readonly input: unknown;
    readonly context: ExecutionContext;
};

export type Outcome = Result<unknown, unknown>;

/** A layer around every use case. It sees the call and the outcome, not the use case. */
export type Middleware = (
    call: Call,
    next: () => Promise<Outcome>,
) => Promise<Outcome>;
