import { Result } from "effect";
import InvalidAmount from "../errors/InvalidAmount.js";

/** A positive amount in euro cents. */
export default class Amount {
    private constructor(readonly cents: number) {}

    static create(cents: number): Result.Result<Amount, InvalidAmount> {
        if (!Number.isInteger(cents) || cents <= 0) {
            return Result.fail(new InvalidAmount({ amount_cents: cents }));
        }
        return Result.succeed(new Amount(cents));
    }

    /** For mappers: the value was valid when it was stored. */
    static fromRaw(cents: number): Amount {
        return new Amount(cents);
    }
}
