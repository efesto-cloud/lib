import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../di/Port.js";
import type { UseCaseInput, UseCaseKey } from "../di/UseCaseRegistry.js";
import Forbidden from "../errors/Forbidden.js";
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
        context: IExecutionContext,
    ) {
        const policy = policies[key] as Policy<UseCaseInput<K>>;
        const allowed = await policy.allows(context.actor, input, {
            expenses: this.expenses,
        });
        return allowed
            ? Result.void
            : Result.fail(new Forbidden({ policy: policy.name }));
    }
}
