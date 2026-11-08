import Forbidden from "@expenses/contract/errors/Forbidden";
import type { UseCaseInput, UseCaseKey } from "@expenses/contract/registry";
import type { ExecutionContext } from "@expenses/contract/useCase";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../di/Port.js";
import type IExpenseRepository from "../repo/IExpenseRepository.js";
import type IAuthorizer from "./IAuthorizer.js";
import { policies } from "./policies.js";
import type { Policy } from "./policy.js";

@injectable()
export default class Authorizer implements IAuthorizer {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async authorize<K extends UseCaseKey>(
        key: K,
        input: UseCaseInput<K>,
        context: ExecutionContext,
    ) {
        const policy = policies[key] as Policy<UseCaseInput<K>>;
        const allowed = await policy.allows(context.actor, input, {
            expenses: this.expenses,
        });
        return allowed
            ? Result.ok()
            : Result.err(new Forbidden({ policy: policy.name }));
    }
}
