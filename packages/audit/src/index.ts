import type IUseCase from "@efesto-cloud/usecase";
import type {
    ExtractUseCaseInput,
    ExtractUseCaseResponse,
    IExecutionContext,
} from "@efesto-cloud/usecase";
import { DateTime } from "luxon";
import { runWithAuditTrace } from "./AuditStore.js";
import { AuditTraceBuilder } from "./AuditTraceBuilder.js";
import { preserveConstructorName } from "./preserveConstructorName.js";
import type { AuditOptions, AuditTrace, IAuditActor } from "./types.js";
import { AUDIT_METADATA_KEYS } from "./types.js";

/**
 * Default persister that logs traces to console.
 * Used when no custom persister is provided.
 */
const defaultPersister = async (trace: AuditTrace) => {
    console.log("[Audit]", JSON.stringify(trace, null, 2));
};

/**
 * Decorator for auditing use case executions.
 *
 * Wraps the use case's execute method to automatically create audit traces
 * with execution metadata, actor information, and custom callbacks.
 *
 * The audit trace is available via getAuditTrace() anywhere in the call stack
 * during use case execution.
 *
 * @template U - The use case type being audited
 * @template TActor - The actor type(s) for this audit
 *
 * @param options - Configuration for the audit behavior
 * @returns Class decorator function
 *
 * @example
 * ```typescript
 * @audit<CreatePostUseCase, UserActor>({
 *   entity: "Post",
 *   title: "Create New Post",
 *   verb: AUDIT_VERBS.CREATE,
 *   ttl: 86400 * 30, // 30 days
 *   onInput: (input, trace) => {
 *     trace.setActor({
 *       type: "USER",
 *       payload: { id: input.userId, email: input.userEmail }
 *     });
 *   },
 *   onOutput: (output, trace) => {
 *     trace.setEntityId(output.postId);
 *   },
 *   persister: async (trace) => {
 *     await db.collection('audit_logs').insertOne(trace);
 *   }
 * })
 * class CreatePostUseCase implements IUseCase<CreatePostInput, CreatePostOutput> {
 *   async execute(input: CreatePostInput): Promise<CreatePostOutput> {
 *     // ... implementation
 *   }
 * }
 * ```
 */
export default function audit<
    U extends IUseCase<unknown, unknown> = IUseCase<unknown, unknown>,
    TActor extends IAuditActor = IAuditActor,
>(options: AuditOptions<U, TActor>) {
    type TRequest = ExtractUseCaseInput<U>;
    type TResponse = ExtractUseCaseResponse<U>;

    // Use provided persister or default to console logging
    const persister = options.persister ?? defaultPersister;
    const captureErrors = options.captureErrors ?? true;

    return <
        T extends new (
            // biome-ignore lint/suspicious/noExplicitAny: required TS mixin signature
            ...args: any[]
        ) => IUseCase<TRequest, TResponse>,
    >(
        target: T,
    ) => {
        class Audited extends target implements IUseCase<TRequest, TResponse> {
            override name = target.name;

            override async execute(
                input: TRequest,
                ctx: IExecutionContext,
            ): Promise<TResponse> {
                const startTime = Date.now();
                const traceBuilder = new AuditTraceBuilder<TActor>();

                return runWithAuditTrace(traceBuilder, async () => {
                    try {
                        // Initialize trace builder with basic info
                        traceBuilder.setUsecase(this.name);
                        traceBuilder.setTitle(options.title);
                        traceBuilder.setVerb(options.verb);

                        // Set entity (handle both class and string)
                        if (typeof options.entity === "string") {
                            traceBuilder.setEntity(options.entity);
                        } else if ("name" in options.entity) {
                            traceBuilder.setEntity(options.entity.name);
                        }

                        // Set expiration if TTL is configured
                        if (
                            options.ttl !== undefined &&
                            options.ttl !== "never"
                        ) {
                            let ttlSeconds: number;
                            if (typeof options.ttl === "number") {
                                ttlSeconds = options.ttl;
                            } else {
                                ttlSeconds = options.ttl.as("seconds");
                            }
                            const expireAt = DateTime.now().plus({
                                seconds: ttlSeconds,
                            }) as DateTime<true>;
                            traceBuilder.setExpireAt(expireAt);
                        }

                        // Call onInput callback if provided
                        if (options.onInput) {
                            options.onInput(input, traceBuilder);
                        }

                        // Execute original use case
                        const result = await super.execute(input, ctx);

                        // Call onOutput callback if provided
                        if (options.onOutput) {
                            options.onOutput(result, traceBuilder);
                        }

                        // Record success metadata
                        const duration = Date.now() - startTime;
                        traceBuilder
                            .getMetadata()
                            .set(
                                AUDIT_METADATA_KEYS.DURATION,
                                duration.toString(),
                            )
                            .set(AUDIT_METADATA_KEYS.SUCCESS, "true");

                        // Build and persist trace
                        try {
                            const trace = traceBuilder.build();
                            await persister(trace);
                        } catch (buildError) {
                            // Log build/persist errors but don't fail the use case
                            console.error(
                                "[Audit] Failed to build or persist trace:",
                                buildError,
                            );
                        }

                        return result;
                    } catch (error) {
                        // Record failure metadata
                        const duration = Date.now() - startTime;
                        traceBuilder
                            .getMetadata()
                            .set(
                                AUDIT_METADATA_KEYS.DURATION,
                                duration.toString(),
                            )
                            .set(AUDIT_METADATA_KEYS.SUCCESS, "false");

                        // Optionally capture error details
                        if (captureErrors && error instanceof Error) {
                            traceBuilder
                                .getMetadata()
                                .set(AUDIT_METADATA_KEYS.ERROR_NAME, error.name)
                                .set(
                                    AUDIT_METADATA_KEYS.ERROR_MESSAGE,
                                    error.message,
                                );
                        }

                        // Build and persist failure trace
                        try {
                            const trace = traceBuilder.build();
                            await persister(trace);
                        } catch (buildError) {
                            console.error(
                                "[Audit] Failed to build or persist trace:",
                                buildError,
                            );
                        }

                        // Re-throw original error
                        throw error;
                    }
                });
            }
        }

        return preserveConstructorName(target, Audited);
    };
}

export { getAuditTrace, runWithAuditTrace } from "./AuditStore.js";
// Re-export core types and utilities
export { AuditTraceBuilder } from "./AuditTraceBuilder.js";
// Re-export example actors
export type { Constructor } from "./preserveConstructorName.js";
export {
    AUDIT_METADATA_KEYS,
    AUDIT_VERBS,
    type AuditOptions,
    type AuditPersister,
    type AuditTrace,
    AuditTraceValidationError,
    type AuditVerb,
    type IAuditActor,
} from "./types.js";
