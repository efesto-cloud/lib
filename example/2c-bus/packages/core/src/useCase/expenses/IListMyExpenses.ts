import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "better-result";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";

interface IListMyExpenses
    extends IUseCase<IListMyExpenses.Input, Result<ExpenseDto[], never>> {}

namespace IListMyExpenses {
    export type Input = Record<string, never>;
}

export type { IListMyExpenses as default };
