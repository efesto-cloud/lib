import type { IAuditActor } from "../src/types.js";

/**
 * Example actor representing a system/service performing an action.
 *
 * Use this for automated processes, background jobs, or internal system operations.
 *
 * @example
 * ```typescript
 * const systemActor: SystemActor = {
 *   type: "SYSTEM",
 *   payload: {
 *     service: "background-worker",
 *     version: "1.2.3"
 *   }
 * };
 * ```
 */
export interface SystemActor extends IAuditActor<"SYSTEM"> {
    payload: {
        /** Service or component name */
        service: string;
        /** Optional version identifier */
        version?: string;
        /** Optional additional metadata */
        [key: string]: unknown;
    };
}

/**
 * Helper to create a system actor.
 */
export function createSystemActor(
    service: string,
    metadata?: Record<string, unknown>,
): SystemActor {
    return {
        type: "SYSTEM",
        payload: {
            service,
            ...metadata,
        },
    };
}
