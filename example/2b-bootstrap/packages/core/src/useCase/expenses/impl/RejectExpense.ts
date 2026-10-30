import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";
import type IRejectExpense from "../IRejectExpense.js";
import transitionExpense from "./transitionExpense.js";

@injectable()
export default class RejectExpense implements IRejectExpense {
    constructor(
        @inject(Port.UnitOfWork) private readonly uow: IUnitOfWork,
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
        @inject(Port.ExpenseStatusChangeRepository)
        private readonly history: IExpenseStatusChangeRepository,
    ) {}

    async execute(input: IRejectExpense.Input, context: IExecutionContext) {
        const result = await transitionExpense(
            { uow: this.uow, expenses: this.expenses, history: this.history },
            input.expense_id,
            "rejected",
            context,
        );
        return Result.map(result, (expense) => expense.toDTO());
    }
}
