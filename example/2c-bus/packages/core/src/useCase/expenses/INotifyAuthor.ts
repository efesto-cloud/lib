import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type ExpenseNotFound from "../../errors/ExpenseNotFound.js";

interface INotifyAuthor
    extends IUseCase<
        INotifyAuthor.Input,
        Result.Result<void, INotifyAuthor.Error>
    > {}

namespace INotifyAuthor {
    export type Input = { expense_id: string };
    export type Error = ExpenseNotFound;
}

export type { INotifyAuthor as default };
