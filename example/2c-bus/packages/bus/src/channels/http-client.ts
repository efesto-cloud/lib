import { type Bus, type CommandResult, resultCodec } from "@expenses/commands";
import { Schema } from "effect";

/** The client side of the HTTP channel. Imports the contract, never the core server. */
export function httpBus(options: {
    url: string;
    token: string | null;
    fetch?: typeof fetch;
}): Bus {
    const send = options.fetch ?? fetch;
    return {
        async dispatch(name, input) {
            const response = await send(
                new Request(`${options.url}/bus/${name}`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        ...(options.token
                            ? { authorization: `Bearer ${options.token}` }
                            : {}),
                    },
                    body: JSON.stringify(input),
                }),
            );
            return Schema.decodeUnknownSync(resultCodec(name))(
                await response.json(),
            ) as CommandResult<typeof name>;
        },
    };
}
