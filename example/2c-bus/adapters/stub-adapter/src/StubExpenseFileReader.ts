import {
    type ExpenseRow,
    type IExpenseFileReader,
    InvalidFile,
} from "@expenses/core";
import { Result } from "better-result";

/** Same format as the real reader, without the heavy library behind it. */
export default class StubExpenseFileReader implements IExpenseFileReader {
    read(file: string): Result<ExpenseRow[], InvalidFile> {
        const [header, ...lines] = file.trim().split("\n");
        if (header?.trim() !== "description,amount_cents") {
            return Result.err(
                new InvalidFile({
                    reason: "expected header description,amount_cents",
                }),
            );
        }
        return Result.ok(
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
