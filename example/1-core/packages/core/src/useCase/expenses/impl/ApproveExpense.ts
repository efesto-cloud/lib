import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IExpenseStatusChangeRepository from "../../../repo/IExpenseStatusChangeRepository.js";
import type IMemberRepository from "../../../repo/IMemberRepository.js";
import type IMailer from "../../../service/IMailer.js";
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
        @inject(Port.MemberRepository)
        private readonly members: IMemberRepository,
        @inject(Port.Mailer) private readonly mailer: IMailer,
    ) {}

    async execute(input: IApproveExpense.Input, context: IExecutionContext) {
        const result = await transitionExpense(
            { uow: this.uow, expenses: this.expenses, history: this.history },
            input.expense_id,
            "approved",
            context,
        );
        if (Result.isFailure(result)) return Result.fail(result.failure);

        const expense = result.success.toDTO();
        const author = await this.members.findById(expense.author_id);
        if (author) {
            await this.mailer.send({
                to: author.email,
                subject: `Nota spese approvata: ${expense.description}`,
            });
        }
        return Result.succeed(expense);
    }
}
