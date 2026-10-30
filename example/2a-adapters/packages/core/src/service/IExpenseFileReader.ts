import type { Result } from "effect";
import type InvalidFile from "../errors/InvalidFile.js";

export type ExpenseRow = { description: string; amount_cents: number };

/** Turns an uploaded file into rows. Parsing libraries are heavy: it is a port. */
export default interface IExpenseFileReader {
    read(file: string): Result.Result<ExpenseRow[], InvalidFile>;
}
