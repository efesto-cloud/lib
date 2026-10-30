import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";

interface IListMyExpenses
    extends IUseCase<
        IListMyExpenses.Input,
        Result.Result<ExpenseDto[], never>
    > {}

namespace IListMyExpenses {
    export type Input = Record<string, never>;
}

export type { IListMyExpenses as default };
