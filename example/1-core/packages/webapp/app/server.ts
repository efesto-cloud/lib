import type { Database } from "@expenses/core";
import { Result } from "effect";
import { createContainer } from "./container.server.js";
import { failure, json } from "./http.js";
import * as expenses from "./routes/expenses.js";

export async function createApp(config: { db: Database; mailUrl: string }) {
    const { resolveUseCase, identifier, authorizer } =
        await createContainer(config);

    return async function handle(request: Request): Promise<Response> {
        const token =
            request.headers.get("authorization")?.replace(/^Bearer /, "") ??
            null;
        const actor = await identifier.identify(token);
        if (Result.isFailure(actor)) return failure(actor.failure);
        const ctx = { resolveUseCase, authorizer, actor: actor.success };

        const { pathname } = new URL(request.url);
        const route = `${request.method} ${pathname}`;

        if (route === "GET /expenses/mine") return expenses.listMine(ctx);
        if (route === "GET /expenses/submitted")
            return expenses.listSubmitted(ctx);
        if (route === "POST /expenses")
            return expenses.create(ctx, await readJson(request));
        if (route === "POST /expenses/import")
            return expenses.importFile(ctx, await request.text());
        const action = pathname.match(
            /^\/expenses\/([^/]+)\/(submit|approve|reject|reimburse)$/,
        );
        if (request.method === "POST" && action) {
            return expenses.transition(
                ctx,
                action[1] as string,
                action[2] as "submit",
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
