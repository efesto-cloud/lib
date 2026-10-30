import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";
import type ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import type InvalidTransition from "../../errors/InvalidTransition.js";

interface IApproveExpense
    extends IUseCase<
        IApproveExpense.Input,
        Result.Result<ExpenseDto, IApproveExpense.Error>
    > {}

namespace IApproveExpense {
    export type Input = { expense_id: string };
    export type Error = ExpenseNotFound | InvalidTransition;
}

export type { IApproveExpense as default };
