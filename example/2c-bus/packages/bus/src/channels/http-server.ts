import { resultCodec } from "@expenses/contract/api";
import { type UseCaseKey, useCases } from "@expenses/contract/registry";
import { z } from "zod";
import type { Dispatcher } from "../dispatcher.js";

/** POST /api/<use case key>. Every outcome, errors included, is a 200 with a Result. */
export function httpChannel(dispatcher: Dispatcher) {
    return async (request: Request): Promise<Response> => {
        const name = new URL(request.url).pathname.match(
            /^\/api\/([A-Za-z.]+)$/,
        )?.[1];
        if (
            request.method !== "POST" ||
            !name ||
            !Object.hasOwn(useCases, name)
        ) {
            return new Response(null, { status: 404 });
        }
        const token =
            request.headers.get("authorization")?.replace(/^Bearer /, "") ??
            null;
        const input = await request.json().catch(() => undefined);
        const outcome = await dispatcher.dispatch(name, input, token);
        const body = z.encode(resultCodec(name as UseCaseKey), outcome);
        return Response.json(body);
    };
}
