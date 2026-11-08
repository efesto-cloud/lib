import type { Api, CallResult } from "@expenses/contract/api";
import type { Dispatcher } from "../dispatcher.js";

/** Same call, no network: mock mode and the contract test. */
export function inProcessApi(
    dispatcher: Dispatcher,
    token: string | null,
): Api {
    return {
        dispatch: (name, input) =>
            dispatcher.dispatch(name, input, token) as Promise<
                CallResult<typeof name>
            >,
    };
}
