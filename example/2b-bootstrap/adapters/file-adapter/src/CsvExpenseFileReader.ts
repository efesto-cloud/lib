import {
    type ExpenseRow,
    type IExpenseFileReader,
    InvalidFile,
} from "@expenses/core";
import { Result } from "effect";

/** Stands in for a real spreadsheet library, the kind of dependency that weighs. */
export default class CsvExpenseFileReader implements IExpenseFileReader {
    read(file: string): Result.Result<ExpenseRow[], InvalidFile> {
        const [header, ...lines] = file.trim().split("\n");
        if (header?.trim() !== "description,amount_cents") {
            return Result.fail(
                new InvalidFile({
                    reason: "expected header description,amount_cents",
                }),
            );
        }
        return Result.succeed(
            lines.map((line) => {
                const [description = "", amount = ""] = line.split(",");
                return {
                    description: description.trim(),
                    amount_cents: Number(amount),
                };
            }),
        );
    }
}
