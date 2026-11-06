import type { IAuthorizer } from "@expenses/core";
import { Result } from "better-result";
import type { Middleware } from "./types.js";

/** The single place where access rules are applied, for every client. */
export function policy(authorizer: IAuthorizer): Middleware {
    return async (call, next) => {
        const allowed = await authorizer.authorize(
            call.useCase,
            call.input as never,
            call.context,
        );
        return Result.isError(allowed) ? allowed : next();
    };
}
