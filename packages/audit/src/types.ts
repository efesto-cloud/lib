import type { IMetadata } from "@efesto-cloud/metadata";
import type IUseCase from "@efesto-cloud/usecase";
import type {
    ExtractUseCaseInput,
    ExtractUseCaseResponse,
} from "@efesto-cloud/usecase";
import type { Duration } from "luxon";
import type { AuditTraceBuilder } from "./AuditTraceBuilder.js";

/**
 * Generic audit actor interface using discriminated union pattern.
 * Extend this to create custom actor types for your domain.
 *
 * @example
 * ```typescript
 * type UserActor = IAuditActor<"USER"> & {
 *   payload: { id: string; email: string }
 * };
 *
 * type SystemActor = IAuditActor<"SYSTEM"> & {
 *   payload: { service: string }
 * };
 *
 * type MyActor = UserActor | SystemActor;
 * ```
 */
export interface IAuditActor<TType extends string = string> {
    /** Discriminator for actor type */
    type: TType;
    /** Actor-specific payload data */
    payload: Record<string, unknown>;
}

/**
 * Common audit action verbs. Extend with your own custom verbs.
 */
export type AuditVerb = string;

export const AUDIT_VERBS = {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    ADD: "ADD",
    REMOVE: "REMOVE",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    UPLOAD: "UPLOAD",
    EXPORT: "EXPORT",
    IMPORT: "IMPORT",
    BATCH: "BATCH",
    DOWNLOAD: "DOWNLOAD",
} as const;

/**
 * Well-known metadata keys used by the audit system.
 */
export const AUDIT_METADATA_KEYS = {
    DURATION: "duration_ms",
    SUCCESS: "success",
    ERROR_NAME: "error_name",
    ERROR_MESSAGE: "error_message",
} as const;

/**
 * Final audit trace object that gets persisted.
 * Contains all information about an audited action.
 *
 * @template TActor - The actor type(s) for this trace
 */
export interface AuditTrace<TActor extends IAuditActor = IAuditActor> {
    /** Unique identifier for this trace */
    _id: string;
    /** Actor who performed the action (null for anonymous/system actions) */
    actor: TActor | null;
    /** Use case identifier */
    usecase: string;
    /** Entity type being acted upon */
    entity: string;
    /** Specific entity instance ID (optional) */
    entity_id: string | null;
    /** ISO 8601 timestamp when action occurred */
    timestamp: string;
    /** ISO 8601 expiration timestamp for TTL (optional, MongoDB-specific) */
    expire_at: string | null;
    /** Key-value metadata about the action */
    metadata: IMetadata;
    /** Human-readable action description */
    title: string;
    /** Action verb (e.g., "CREATE", "UPDATE") */
    verb: AuditVerb;
}

/**
 * Callback function for persisting audit traces.
 * Implement this to save traces to your storage backend.
 *
 * @example
 * ```typescript
 * const persister: AuditPersister = async (trace) => {
 *   await db.collection('audit_logs').insertOne(trace);
 * };
 * ```
 */
export type AuditPersister<TActor extends IAuditActor = IAuditActor> = (
    trace: AuditTrace<TActor>,
) => Promise<void>;

/**
 * Configuration options for the @audit decorator.
 *
 * @template U - The use case type being audited
 * @template TActor - The actor type(s) for this audit
 */
export interface AuditOptions<
    U extends IUseCase = IUseCase,
    TActor extends IAuditActor = IAuditActor,
> {
    /** Entity class or string name being acted upon */
    entity:
        | {
              // biome-ignore lint/suspicious/noExplicitAny: required TS mixin signature
              new (...args: any[]): { constructor: { name: string } };
          }
        | string;

    /** Human-readable action description */
    title: string;

    /** Action verb */
    verb: AuditVerb;

    /**
     * Time-to-live for the audit trace (MongoDB TTL feature).
     * - number: seconds until expiration
     * - Duration: luxon Duration object
     * - "never": no expiration (default)
     */
    ttl?: number | Duration | "never";

    /**
     * Callback invoked before use case execution.
     * Use this to capture input data or set custom trace fields.
     */
    onInput?: (
        input: ExtractUseCaseInput<U>,
        trace: AuditTraceBuilder<TActor>,
    ) => void;

    /**
     * Callback invoked after successful use case execution.
     * Use this to capture output data or set custom trace fields.
     */
    onOutput?: (
        output: ExtractUseCaseResponse<U>,
        trace: AuditTraceBuilder<TActor>,
    ) => void;

    /**
     * Persistence callback for saving the audit trace.
     * If not provided, traces are logged to console.
     */
    persister?: AuditPersister<TActor>;

    /**
     * Whether to automatically capture error details in metadata.
     * Default: true
     */
    captureErrors?: boolean;
}

/**
 * Error thrown when building a trace with missing required fields.
 */
export class AuditTraceValidationError extends Error {
    constructor(public readonly missingFields: string[]) {
        super(
            `Audit trace validation failed. Missing fields: ${missingFields.join(", ")}`,
        );
        this.name = "AuditTraceValidationError";
    }
}
