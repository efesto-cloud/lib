import type { IAuditActor } from "../src/types.js";

/**
 * Example actor representing a user performing an action.
 *
 * Use this for user-initiated operations in your application.
 *
 * @example
 * ```typescript
 * const userActor: UserActor = {
 *   type: "USER",
 *   payload: {
 *     id: "user-123",
 *     email: "user@example.com",
 *     name: "John Doe"
 *   }
 * };
 * ```
 */
export interface UserActor extends IAuditActor<"USER"> {
    payload: {
        /** Unique user identifier */
        id: string;
        /** User email address */
        email?: string;
        /** User display name */
        name?: string;
        /** Optional IP address */
        ip?: string;
        /** Optional additional metadata */
        [key: string]: unknown;
    };
}

/**
 * Helper to create a user actor.
 */
export function createUserActor(
    id: string,
    metadata?: Omit<UserActor["payload"], "id">,
): UserActor {
    return {
        type: "USER",
        payload: {
            id,
            ...metadata,
        },
    };
}
