import type { ExecutionContext } from "@expenses/contract/useCase";
import type { ICreateExpense } from "@expenses/contract/useCase/expenses/CreateExpense";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import Expense from "../../../entity/Expense.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";

@injectable()
export default class CreateExpense implements ICreateExpense {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
    ) {}

    async execute(input: ICreateExpense.Input, context: ExecutionContext) {
        const expense = Expense.create({
            ...input,
            author_id: context.actor.id,
        });
        if (Result.isError(expense)) return Result.err(expense.error);

        await this.expenses.save(expense.value);
        return Result.ok(expense.value.toDTO());
    }
}
