import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";
import type ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import type InvalidTransition from "../../errors/InvalidTransition.js";

interface ISubmitExpense
    extends IUseCase<
        ISubmitExpense.Input,
        Result.Result<ExpenseDto, ISubmitExpense.Error>
    > {}

namespace ISubmitExpense {
    export type Input = { expense_id: string };
    export type Error = ExpenseNotFound | InvalidTransition;
}

export type { ISubmitExpense as default };
