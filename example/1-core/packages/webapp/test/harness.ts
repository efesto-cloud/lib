import { Database } from "@expenses/core";
import { createApp } from "../app/server.js";

export type Mail = { to: string; subject: string };

export async function start() {
    const db = new Database();
    db.seed();
    const sent: Mail[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 202 });
    };
    const handle = await createApp({ db, mailUrl: "http://mail.test/send" });
    return {
        handle,
        sentMail: async () => sent,
        stop: () => {
            globalThis.fetch = realFetch;
        },
    };
}
