import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inProcessBus } from "@expenses/bus";
import { httpBus } from "@expenses/bus/client";
import { createBusServer } from "@expenses/bus-server";
import type { Bus } from "@expenses/commands";
import { createConsumer } from "@expenses/consumer";
import { Database } from "@expenses/db-adapter";
import { seededStore } from "@expenses/stub-adapter";
import { createApp as createAdmin } from "@expenses/webapp-admin";
import { createApp as createStaff } from "@expenses/webapp-staff";

export type Mail = { to: string; subject: string };

const ADMIN_ROUTES =
    /^\/expenses\/(submitted|import|[^/]+\/(approve|reject|reimburse))$/;

/**
 * Two webapps, the bus server and a consumer. HARNESS picks stub or SQLite;
 * CHANNEL picks how the webapps reach the bus: in-process or HTTP.
 */
export async function start() {
    let readMail: () => Mail[];
    let env: Record<string, string>;
    let options = {};
    let restore = () => {};

    if (process.env.HARNESS === "db") {
        const dir = mkdtempSync(join(tmpdir(), "expenses-"));
        env = {
            DB_PATH: join(dir, "db.sqlite"),
            MAIL_URL: "http://mail.test/send",
            QUEUE_PATH: join(dir, "queue.sqlite"),
        };
        new Database(env.DB_PATH).seed();
        const sent: Mail[] = [];
        readMail = () => sent;
        const realFetch = globalThis.fetch;
        globalThis.fetch = async (_url, init) => {
            sent.push(JSON.parse(String(init?.body)));
            return new Response(null, { status: 202 });
        };
        restore = () => {
            globalThis.fetch = realFetch;
        };
    } else {
        const store = seededStore();
        env = { MOCK: "1" };
        options = { store };
        readMail = () => store.sentMail;
    }

    const server = await createBusServer(env, { ...options, audit: () => {} });
    const busFor = (token: string | null): Bus =>
        process.env.CHANNEL === "http"
            ? httpBus({
                  url: "http://bus.test",
                  token,
                  fetch: (request) => server.handle(request as Request),
              })
            : inProcessBus(server.dispatcher, token);

    const staff = createStaff({ busFor });
    const admin = createAdmin({ busFor });
    const consumer = await createConsumer(env, options);

    return {
        handle: (request: Request) =>
            (ADMIN_ROUTES.test(new URL(request.url).pathname) ? admin : staff)(
                request,
            ),
        sentMail: async () => {
            await consumer.runPending();
            return readMail();
        },
        stop: restore,
    };
}
