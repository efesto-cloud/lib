import type IUseCase from "@efesto-cloud/usecase";
import type {
    IAuthorizer,
    MemberDto,
    ResolveUseCase,
    UseCaseInput,
    UseCaseKey,
} from "@expenses/core";
import { Result } from "effect";
import { failure, json } from "../http.js";

export type RouteContext = {
    resolveUseCase: ResolveUseCase;
    authorizer: IAuthorizer;
    actor: MemberDto;
};

/**
 * Up to rung 2·B every route applies the policy itself, before the use case.
 * At 2·C the bus middleware does it once for every client.
 */
export async function run<K extends UseCaseKey>(
    ctx: RouteContext,
    key: K,
    input: UseCaseInput<K>,
    status = 200,
) {
    const context = { actor: ctx.actor };
    const allowed = await ctx.authorizer.authorize(key, input, context);
    if (Result.isFailure(allowed)) return failure(allowed.failure);

    const useCase = ctx.resolveUseCase(key) as IUseCase<
        UseCaseInput<K>,
        Result.Result<unknown, { _tag: string }>
    >;
    const result = await useCase.execute(input, context);
    return Result.isSuccess(result)
        ? json(status, result.success)
        : failure(result.failure);
}
