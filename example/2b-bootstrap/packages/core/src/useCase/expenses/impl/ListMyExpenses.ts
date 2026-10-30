import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IListMyExpenses from "../IListMyExpenses.js";

/** The actor is data here: it says whose expenses, not whether one may ask. */
@injectable()
export default class ListMyExpenses implements IListMyExpenses {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async execute(_input: IListMyExpenses.Input, context: IExecutionContext) {
        const expenses = await this.expenses.list({
            author_id: context.actor.id,
        });
        return Result.succeed(expenses.map((e) => e.toDTO()));
    }
}
