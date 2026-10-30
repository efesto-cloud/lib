import { openDb, seed } from "../app/db.server.js";
import { createApp } from "../app/server.js";

export type Mail = { to: string; subject: string };

export async function start() {
    const db = openDb();
    seed(db);
    const sent: Mail[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 202 });
    };
    const handle = createApp({ db, mailUrl: "http://mail.test/send" });
    return {
        handle,
        sentMail: async () => sent,
        stop: () => {
            globalThis.fetch = realFetch;
        },
    };
}
