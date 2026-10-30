import type { IExecutionContext } from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { UseCaseInput, UseCaseKey } from "../di/UseCaseRegistry.js";
import type Forbidden from "../errors/Forbidden.js";

export default interface IAuthorizer {
    authorize<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: IExecutionContext,
    ): Promise<Result.Result<void, Forbidden>>;
}
