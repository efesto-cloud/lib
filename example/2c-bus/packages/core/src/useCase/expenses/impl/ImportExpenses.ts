import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { IExecutionContext } from "@efesto-cloud/usecase";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import { Port } from "../../../di/Port.js";
import ImportRowInvalid from "../../../errors/ImportRowInvalid.js";
import type IExpenseFileReader from "../../../service/IExpenseFileReader.js";
import type ICreateExpense from "../ICreateExpense.js";
import type IImportExpenses from "../IImportExpenses.js";

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

    async execute(input: IImportExpenses.Input, context: IExecutionContext) {
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
