import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type { ExpenseDto } from "../../dto/ExpenseDto.js";
import type InvalidAmount from "../../errors/InvalidAmount.js";

interface ICreateExpense
    extends IUseCase<
        ICreateExpense.Input,
        Result.Result<ExpenseDto, ICreateExpense.Error>
    > {}

namespace ICreateExpense {
    export type Input = { description: string; amount_cents: number };
    export type Error = InvalidAmount;
}

export type { ICreateExpense as default };
