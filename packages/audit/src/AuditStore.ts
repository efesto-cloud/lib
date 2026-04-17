import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditTraceBuilder } from "./AuditTraceBuilder.js";
import type { IAuditActor } from "./types.js";

/**
 * AsyncLocalStorage-based store for managing audit trace builders.
 *
 * This provides context propagation so that the current trace builder
 * is accessible anywhere in the async call stack without explicit passing.
 */
class AuditStore<TActor extends IAuditActor = IAuditActor> {
    private storage = new AsyncLocalStorage<AuditTraceBuilder<TActor>>();

    /**
     * Run a function with an audit trace builder in context.
     *
     * @param builder - The trace builder to make available
     * @param fn - The function to execute with the builder in context
     * @returns The result of the function
     */
    run<R>(builder: AuditTraceBuilder<TActor>, fn: () => R): R {
        return this.storage.run(builder, fn);
    }

    /**
     * Get the current audit trace builder from context.
     *
     * @returns The current builder, or null if not in an audit context
     */
    get(): AuditTraceBuilder<TActor> | null {
        return this.storage.getStore() ?? null;
    }
}

/**
 * Global audit store instance.
 *
 * @internal
 */
const globalAuditStore = new AuditStore();

/**
 * Run a function with an audit trace builder in context.
 *
 * The builder will be accessible via getAuditTrace() anywhere in the
 * async call stack within the function.
 *
 * @param builder - The trace builder to make available
 * @param fn - The function to execute
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const builder = new AuditTraceBuilder();
 * const result = await runWithAuditTrace(builder, async () => {
 *   // Builder is available here
 *   const trace = getAuditTrace();
 *   trace?.setTitle("Something");
 *   return await doWork();
 * });
 * ```
 */
export function runWithAuditTrace<TActor extends IAuditActor, R>(
    builder: AuditTraceBuilder<TActor>,
    fn: () => R,
): R {
    return (globalAuditStore as AuditStore<TActor>).run(builder, fn);
}

/**
 * Get the current audit trace builder from context.
 *
 * This retrieves the builder set by runWithAuditTrace() or by the @audit decorator.
 * Returns null if not currently executing within an audit context.
 *
 * @returns The current trace builder, or null
 *
 * @example
 * ```typescript
 * // Deep in your call stack:
 * const trace = getAuditTrace();
 * if (trace) {
 *   trace.getMetadata().set("user_ip", request.ip);
 * }
 * ```
 */
export function getAuditTrace<
    TActor extends IAuditActor = IAuditActor,
>(): AuditTraceBuilder<TActor> | null {
    return (globalAuditStore as AuditStore<TActor>).get();
}
