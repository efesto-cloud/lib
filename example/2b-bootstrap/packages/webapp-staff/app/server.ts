import {
    type BootOptions,
    bootstrapStaff,
    type Env,
} from "@expenses/bootstrap/staff";
import { Result } from "effect";
import { failure, json } from "./http.js";
import * as expenses from "./routes/expenses.js";

export async function createApp(env: Env, options?: BootOptions) {
    const { resolveUseCase, identifier, authorizer } = await bootstrapStaff(
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

        if (route === "GET /expenses/mine") return expenses.listMine(ctx);
        if (route === "POST /expenses")
            return expenses.create(ctx, await readJson(request));
        const submit = pathname.match(/^\/expenses\/([^/]+)\/submit$/);
        if (request.method === "POST" && submit)
            return expenses.submit(ctx, submit[1] as string);
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
