import {
    type BootOptions,
    bootstrapBus,
    type Env,
} from "@expenses/bootstrap/bus";
import {
    type AuditEntry,
    audit,
    createDispatcher,
    httpChannel,
} from "@expenses/bus";

/**
 * The deployable: bootstrap, then the bus behind its channels. Data, secrets
 * and heavy dependencies live here, in one place.
 */
export async function createBusServer(
    env: Env,
    options: BootOptions & { audit?: (entry: AuditEntry) => void } = {},
) {
    const core = await bootstrapBus(env, options);
    const dispatcher = createDispatcher(core, {
        middleware: [
            audit(
                options.audit ??
                    ((entry) => console.info("[audit]", JSON.stringify(entry))),
            ),
        ],
    });
    return { dispatcher, handle: httpChannel(dispatcher) };
}
