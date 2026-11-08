import { Result } from "better-result";
import type { Middleware } from "./types.js";

export type AuditEntry = {
    useCase: string;
    actor_id: string;
    input: unknown;
    outcome: string;
};

/** Records who sent what and how it ended. Where it goes is the caller's choice. */
export function audit(write: (entry: AuditEntry) => void): Middleware {
    return async (call, next) => {
        const outcome = await next();
        write({
            useCase: call.useCase,
            actor_id: call.context.actor.id,
            input: call.input,
            outcome: Result.isOk(outcome)
                ? "ok"
                : String((outcome.error as { _tag?: string })._tag),
        });
        return outcome;
    };
}
