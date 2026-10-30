import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IListSubmittedExpenses from "../IListSubmittedExpenses.js";

@injectable()
export default class ListSubmittedExpenses implements IListSubmittedExpenses {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async execute() {
        const expenses = await this.expenses.list({ status: "submitted" });
        return Result.succeed(expenses.map((e) => e.toDTO()));
    }
}
