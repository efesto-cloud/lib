import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import Expense from "../../../entity/Expense.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type ICreateExpense from "../ICreateExpense.js";

@injectable()
export default class CreateExpense implements ICreateExpense {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async execute(input: ICreateExpense.Input, context: IExecutionContext) {
        const expense = Expense.create({
            ...input,
            author_id: context.actor.id,
        });
        if (Result.isFailure(expense)) return Result.fail(expense.failure);

        await this.expenses.save(expense.success);
        return Result.succeed(expense.success.toDTO());
    }
}
