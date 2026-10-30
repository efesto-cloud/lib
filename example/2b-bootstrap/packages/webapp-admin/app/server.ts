import {
    type BootOptions,
    bootstrapAdmin,
    type Env,
} from "@expenses/bootstrap/admin";
import { Result } from "effect";
import { failure, json } from "./http.js";
import * as expenses from "./routes/expenses.js";

export async function createApp(env: Env, options?: BootOptions) {
    const { resolveUseCase, identifier, authorizer } = await bootstrapAdmin(
        env,
        options,
    );

    return async function handle(request: Request): Promise<Response> {
        const token =
            request.headers.get("authorization")?.replace(/^Bearer /, "") ??
            null;
        const actor = await identifier.identify(token);
        if (Result.isFailure(actor)) return failure(actor.failure);
        const ctx = { resolveUseCase, authorizer, actor: actor.success };

        const { pathname } = new URL(request.url);
        const route = `${request.method} ${pathname}`;

        if (route === "GET /expenses/submitted")
            return expenses.listSubmitted(ctx);
        if (route === "POST /expenses/import")
            return expenses.importFile(ctx, await request.text());
        const action = pathname.match(
            /^\/expenses\/([^/]+)\/(approve|reject|reimburse)$/,
        );
        if (request.method === "POST" && action) {
            return expenses.review(
                ctx,
                action[1] as string,
                action[2] as "approve",
            );
        }
        return json(404, { error: "NotFound" });
    };
}
