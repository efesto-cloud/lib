import { type Api, type CallResult, resultCodec } from "@expenses/contract/api";
import { z } from "zod";

/** The client side of the HTTP channel. Imports the contract, never the core. */
export function httpApi(options: {
    url: string;
    token: string | null;
    fetch?: typeof fetch;
}): Api {
    const send = options.fetch ?? fetch;
    return {
        async dispatch(name, input) {
            const response = await send(
                new Request(`${options.url}/api/${name}`, {
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
            return z.decode(
                resultCodec(name),
                await response.json(),
            ) as CallResult<typeof name>;
        },
    };
}
