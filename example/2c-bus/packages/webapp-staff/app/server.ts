import type { Bus } from "@expenses/commands";
import { json } from "./http.js";
import * as expenses from "./routes/expenses.js";

/** No core, no container: the webapp talks to the bus with the user's token. */
export function createApp(options: { busFor: (token: string | null) => Bus }) {
    return async function handle(request: Request): Promise<Response> {
        const token =
            request.headers.get("authorization")?.replace(/^Bearer /, "") ??
            null;
        const bus = options.busFor(token);

        const { pathname } = new URL(request.url);
        const route = `${request.method} ${pathname}`;

        if (route === "GET /expenses/mine") return expenses.listMine(bus);
        if (route === "POST /expenses")
            return expenses.create(bus, await readJson(request));
        const submit = pathname.match(/^\/expenses\/([^/]+)\/submit$/);
        if (request.method === "POST" && submit)
            return expenses.submit(bus, submit[1] as string);
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
