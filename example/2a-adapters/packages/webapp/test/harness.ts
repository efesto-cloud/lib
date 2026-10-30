import { Database } from "@expenses/db-adapter";
import { seededStore } from "@expenses/stub-adapter";
import { createApp } from "../app/server.js";

export type Mail = { to: string; subject: string };

/** HARNESS=stub runs the scenario in mock mode, HARNESS=db on SQLite. */
export async function start() {
    if (process.env.HARNESS === "db") return startOnDb();
    const store = seededStore();
    const handle = await createApp({ mock: true, store });
    return { handle, sentMail: async () => store.sentMail, stop: () => {} };
}

async function startOnDb() {
    const db = new Database();
    db.seed();
    const sent: Mail[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 202 });
    };
    const handle = await createApp({
        mock: false,
        db,
        mailUrl: "http://mail.test/send",
    });
    return {
        handle,
        sentMail: async () => sent,
        stop: () => {
            globalThis.fetch = realFetch;
        },
    };
}
