import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";

interface IListSubmittedExpenses
    extends IUseCase<
        IListSubmittedExpenses.Input,
        Result.Result<ExpenseDto[], never>
    > {}

namespace IListSubmittedExpenses {
    export type Input = Record<string, never>;
}

export type { IListSubmittedExpenses as default };
