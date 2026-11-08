import type { ExecutionContext } from "@expenses/contract/useCase";
import type { IListMyExpenses } from "@expenses/contract/useCase/expenses/ListMyExpenses";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";

/** The actor is data here: it says whose expenses, not whether one may ask. */
@injectable()
export default class ListMyExpenses implements IListMyExpenses {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async execute(_input: IListMyExpenses.Input, context: ExecutionContext) {
        const expenses = await this.expenses.list({
            author_id: context.actor.id,
        });
        return Result.ok(expenses.map((e) => e.toDTO()));
    }
}
