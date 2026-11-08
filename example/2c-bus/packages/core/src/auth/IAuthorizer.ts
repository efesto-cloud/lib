import type Forbidden from "@expenses/contract/errors/Forbidden";
import type { UseCaseInput, UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type { Result } from "better-result";

export default interface IAuthorizer {
    authorize<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: ExecutionContext,
    ): Promise<Result<void, Forbidden>>;
}
