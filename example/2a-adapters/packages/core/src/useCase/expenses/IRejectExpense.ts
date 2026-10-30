import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";
import type ExpenseNotFound from "../../errors/ExpenseNotFound.js";
import type InvalidTransition from "../../errors/InvalidTransition.js";

interface IRejectExpense
    extends IUseCase<
        IRejectExpense.Input,
        Result.Result<ExpenseDto, IRejectExpense.Error>
    > {}

namespace IRejectExpense {
    export type Input = { expense_id: string };
    export type Error = ExpenseNotFound | InvalidTransition;
}

export type { IRejectExpense as default };
