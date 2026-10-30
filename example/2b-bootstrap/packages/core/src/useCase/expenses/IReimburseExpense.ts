import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";
import type ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import type InvalidTransition from "../../errors/InvalidTransition.js";

interface IReimburseExpense
    extends IUseCase<
        IReimburseExpense.Input,
        Result.Result<ExpenseDto, IReimburseExpense.Error>
    > {}

namespace IReimburseExpense {
    export type Input = { expense_id: string };
    export type Error = ExpenseNotFound | InvalidTransition;
}

export type { IReimburseExpense as default };
