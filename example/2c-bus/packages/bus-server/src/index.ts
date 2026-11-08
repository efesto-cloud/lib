import {
    type BootOptions,
    bootstrapBus,
    type Env,
} from "@expenses/bootstrap/bus";
import { httpChannel } from "@expenses/bus/channels/http-server";
import { createDispatcher } from "@expenses/bus/dispatcher";
import { type AuditEntry, audit } from "@expenses/bus/middleware/audit";

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
