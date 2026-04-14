import type { IAuditActor } from "../src/types.js";

/**
 * Example actor representing an API key/service account performing an action.
 *
 * Use this for API-authenticated requests or service-to-service operations.
 *
 * @example
 * ```typescript
 * const apiKeyActor: ApiKeyActor = {
 *   type: "API_KEY",
 *   payload: {
 *     keyId: "key-abc123",
 *     name: "Production API Key",
 *     scopes: ["read", "write"]
 *   }
 * };
 * ```
 */
export interface ApiKeyActor extends IAuditActor<"API_KEY"> {
    payload: {
        /** API key identifier (not the secret) */
        keyId: string;
        /** Human-readable key name */
        name?: string;
        /** Optional scopes or permissions */
        scopes?: string[];
        /** Optional organization/owner ID */
        ownerId?: string;
        /** Optional additional metadata */
        [key: string]: unknown;
    };
}

/**
 * Helper to create an API key actor.
 */
export function createApiKeyActor(
    keyId: string,
    metadata?: Omit<ApiKeyActor["payload"], "keyId">,
): ApiKeyActor {
    return {
        type: "API_KEY",
        payload: {
            keyId,
            ...metadata,
        },
    };
}
