import { Result } from "effect";
import type { Middleware } from "./types.js";

export type AuditEntry = {
    command: string;
    actor_id: string;
    input: unknown;
    outcome: string;
};

/** Records who sent what and how it ended. Where it goes is the caller's choice. */
export function audit(write: (entry: AuditEntry) => void): Middleware {
    return async (call, next) => {
        const outcome = await next();
        write({
            command: call.command,
            actor_id: call.context.actor.id,
            input: call.input,
            outcome: Result.isSuccess(outcome)
                ? "ok"
                : String((outcome.failure as { _tag?: string })._tag),
        });
        return outcome;
    };
}
