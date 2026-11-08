import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import ImportRowInvalid from "@expenses/contract/errors/ImportRowInvalid";
import type { ExecutionContext } from "@expenses/contract/useCase";
import type { ICreateExpense } from "@expenses/contract/useCase/expenses/CreateExpense";
import type { IImportExpenses } from "@expenses/contract/useCase/expenses/ImportExpenses";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import type IExpenseFileReader from "../../../service/IExpenseFileReader.js";

/**
 * Calls another use case: by interface, through DI, with the same context.
 * CreateExpense's writes join this transaction, so a bad row undoes them all.
 */
@injectable()
export default class ImportExpenses implements IImportExpenses {
    constructor(
        @inject(Port.UnitOfWork) private readonly uow: IUnitOfWork,
        @inject(Port.ExpenseFileReader)
        private readonly reader: IExpenseFileReader,
        @inject("expenses.CreateExpense")
        private readonly create: ICreateExpense,
    ) {}

    async execute(input: IImportExpenses.Input, context: ExecutionContext) {
        const rows = this.reader.read(input.file);
        if (Result.isError(rows)) return Result.err(rows.error);

        return this.uow.runWithTransaction<
            { created: number },
            IImportExpenses.Error
        >(async () => {
            for (const [index, row] of rows.value.entries()) {
                const created = await this.create.execute(row, context);
                if (Result.isError(created)) {
                    return Result.err(
                        new ImportRowInvalid({
                            row: index + 1,
                            reason: created.error._tag,
                        }),
                    );
                }
            }
            return Result.ok({ created: rows.value.length });
        });
    }
}
