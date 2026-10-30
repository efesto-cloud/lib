import type { Bus, CommandResult } from "@expenses/commands";
import type { Dispatcher } from "../dispatcher.js";

/** Same call, no network: mock mode and the contract test. */
export function inProcessBus(
    dispatcher: Dispatcher,
    token: string | null,
): Bus {
    return {
        dispatch: (name, input) =>
            dispatcher.dispatch(name, input, token) as Promise<
                CommandResult<typeof name>
            >,
    };
}
