import InvalidAmount from "@expenses/contract/errors/InvalidAmount";
import { Result } from "better-result";

/** A positive amount in euro cents. */
export default class Amount {
    private constructor(readonly cents: number) {}

    static create(cents: number): Result<Amount, InvalidAmount> {
        if (!Number.isInteger(cents) || cents <= 0) {
            return Result.err(new InvalidAmount({ amount_cents: cents }));
        }
        return Result.ok(new Amount(cents));
    }

    /** For mappers: the value was valid when it was stored. */
    static fromRaw(cents: number): Amount {
        return new Amount(cents);
    }
}
