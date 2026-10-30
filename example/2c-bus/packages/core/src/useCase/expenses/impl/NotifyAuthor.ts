import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import ExpenseNotFound from "../../../errors/ExpenseNotFound.js";
import type IExpenseRepository from "../../../repo/IExpenseRepository.js";
import type IMemberRepository from "../../../repo/IMemberRepository.js";
import type IMailer from "../../../service/IMailer.js";
import type INotifyAuthor from "../INotifyAuthor.js";

/** Runs as a job. It does not know it runs later: it is a use case like the others. */
@injectable()
export default class NotifyAuthor implements INotifyAuthor {
    constructor(
        @inject(Port.ExpenseRepository)
        private readonly expenses: IExpenseRepository,
        @inject(Port.MemberRepository)
        private readonly members: IMemberRepository,
        @inject(Port.Mailer) private readonly mailer: IMailer,
    ) {}

    async execute(input: INotifyAuthor.Input) {
        const expense = await this.expenses.findById(input.expense_id);
        if (!expense)
            return Result.fail(
                new ExpenseNotFound({ expense_id: input.expense_id }),
            );

        const dto = expense.toDTO();
        const author = await this.members.findById(dto.author_id);
        if (author) {
            await this.mailer.send({
                to: author.email,
                subject: `Nota spese ${dto.status}: ${dto.description}`,
            });
        }
        return Result.void;
    }
}
