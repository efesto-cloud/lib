import type { Db } from "./db.server.js";
import { json, type Member } from "./http.js";
import * as expenses from "./routes/expenses.js";

export type AppConfig = {
    db: Db;
    /** Endpoint of the mail provider. Without it, mails are printed. */
    mailUrl?: string;
};

export function createApp({ db, mailUrl }: AppConfig) {
    async function mail(to: string, subject: string) {
        if (!mailUrl) {
            console.info(`[mail] ${to}: ${subject}`);
            return;
        }
        await fetch(mailUrl, {
            method: "POST",
            body: JSON.stringify({ to, subject }),
        });
    }

    function authenticate(request: Request): Member | null {
        const token = request.headers
            .get("authorization")
            ?.replace(/^Bearer /, "");
        if (!token) return null;
        return (db
            .prepare("select id, name, email, role from member where token = ?")
            .get(token) ?? null) as Member | null;
    }

    return async function handle(request: Request): Promise<Response> {
        const member = authenticate(request);
        if (!member) return json(401, { error: "Unauthenticated" });

        const { pathname } = new URL(request.url);
        const route = `${request.method} ${pathname}`;

        if (route === "GET /expenses/mine")
            return expenses.listMine(db, member);
        if (route === "GET /expenses/submitted")
            return expenses.listSubmitted(db, member);
        if (route === "POST /expenses")
            return expenses.create(db, member, await readJson(request));
        if (route === "POST /expenses/import") {
            return expenses.importCsv(db, member, await request.text());
        }
        const action = pathname.match(
            /^\/expenses\/([^/]+)\/(submit|approve|reject|reimburse)$/,
        );
        if (request.method === "POST" && action) {
            const to = (
                {
                    submit: "submitted",
                    approve: "approved",
                    reject: "rejected",
                    reimburse: "reimbursed",
                } as const
            )[action[2] as "submit" | "approve" | "reject" | "reimburse"];
            return expenses.transition(
                db,
                member,
                action[1] as string,
                to,
                mail,
            );
        }
        return json(404, { error: "NotFound" });
    };
}

async function readJson(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        return undefined;
    }
}
