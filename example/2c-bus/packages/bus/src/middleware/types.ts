import type { IExecutionContext } from "@efesto-cloud/usecase";
import type { CommandName } from "@expenses/commands";
import type { UseCaseKey } from "@expenses/core";
import type { Result } from "effect";

export type Call = {
    readonly command: CommandName;
    readonly useCase: UseCaseKey;
    readonly input: unknown;
    readonly context: IExecutionContext;
};

export type Outcome = Result.Result<unknown, unknown>;

/** A layer around every handler. It sees the call and the outcome, not the handler. */
export type Middleware = (
    call: Call,
    next: () => Promise<Outcome>,
) => Promise<Outcome>;
