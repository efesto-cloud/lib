import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type { IApproveExpense } from "@expenses/contract/useCase/expenses/ApproveExpense";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";
import type IJobQueue from "../../../service/IJobQueue.js";
import transitionExpense from "./transitionExpense.js";

@injectable()
export default class ApproveExpense implements IApproveExpense {
    constructor(
        @inject(Port.UnitOfWork) private readonly uow: IUnitOfWork,
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
        @inject(Port.ExpenseStatusChangeRepository)
        private readonly history: IExpenseStatusChangeRepository,
        @inject(Port.JobQueue) private readonly jobs: IJobQueue,
    ) {}

    async execute(input: IApproveExpense.Input, context: ExecutionContext) {
        const result = await transitionExpense(
            { uow: this.uow, expenses: this.expenses, history: this.history },
            input.expense_id,
            "approved",
            context,
        );
        if (Result.isError(result)) return Result.err(result.error);

        await this.jobs.enqueue(
            "expenses.NotifyAuthor",
            { expense_id: input.expense_id },
            context,
        );
        return Result.ok(result.value.toDTO());
    }
}
