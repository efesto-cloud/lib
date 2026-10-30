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

        if (route === "GET /expenses/submitted")
            return expenses.listSubmitted(bus);
        if (route === "POST /expenses/import")
            return expenses.importFile(bus, await request.text());
        const action = pathname.match(
            /^\/expenses\/([^/]+)\/(approve|reject|reimburse)$/,
        );
        if (request.method === "POST" && action) {
            return expenses.review(
                bus,
                action[1] as string,
                action[2] as "approve",
            );
        }
        return json(404, { error: "NotFound" });
    };
}
