import { Schema } from "effect";

export default class ImportRowInvalid extends Schema.TaggedError<ImportRowInvalid>()(
    "ImportRowInvalid",
    {
        row: Schema.Number,
        reason: Schema.String,
    },
) {}
