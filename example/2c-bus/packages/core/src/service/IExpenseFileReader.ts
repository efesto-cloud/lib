import type InvalidFile from "@expenses/contract/errors/InvalidFile";
import type { Result } from "better-result";

export type ExpenseRow = { description: string; amount_cents: number };

/** Turns an uploaded file into rows. Parsing libraries are heavy: it is a port. */
export default interface IExpenseFileReader {
    read(file: string): Result<ExpenseRow[], InvalidFile>;
}
