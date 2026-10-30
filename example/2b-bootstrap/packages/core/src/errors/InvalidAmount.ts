import { Schema } from "effect";

export default class InvalidAmount extends Schema.TaggedError<InvalidAmount>()(
    "InvalidAmount",
    {
        amount_cents: Schema.Number,
    },
) {}
