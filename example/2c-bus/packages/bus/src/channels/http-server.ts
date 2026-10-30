import { type CommandName, commands, resultCodec } from "@expenses/commands";
import { Schema } from "effect";
import type { Dispatcher } from "../dispatcher.js";

/** POST /bus/<command>. Every outcome, errors included, is a 200 with a Result. */
export function httpChannel(dispatcher: Dispatcher) {
    return async (request: Request): Promise<Response> => {
        const name = new URL(request.url).pathname.match(
            /^\/bus\/([A-Za-z]+)$/,
        )?.[1];
        if (
            request.method !== "POST" ||
            !name ||
            !Object.hasOwn(commands, name)
        ) {
            return new Response(null, { status: 404 });
        }
        const token =
            request.headers.get("authorization")?.replace(/^Bearer /, "") ??
            null;
        const input = await request.json().catch(() => undefined);
        const outcome = await dispatcher.dispatch(name, input, token);
        const body = Schema.encodeUnknownSync(resultCodec(name as CommandName))(
            outcome,
        );
        return Response.json(body);
    };
}
