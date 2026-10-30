import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";
import type IJobQueue from "../../../service/IJobQueue.js";
import type IApproveExpense from "../IApproveExpense.js";
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

    async execute(input: IApproveExpense.Input, context: IExecutionContext) {
        const result = await transitionExpense(
            { uow: this.uow, expenses: this.expenses, history: this.history },
            input.expense_id,
            "approved",
            context,
        );
        if (Result.isFailure(result)) return Result.fail(result.failure);

        await this.jobs.enqueue(
            "expenses.NotifyAuthor",
            { expense_id: input.expense_id },
            context,
        );
        return Result.succeed(result.success.toDTO());
    }
}
