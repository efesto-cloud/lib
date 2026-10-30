import { Schema } from "effect";

export default class InvalidFile extends Schema.TaggedError<InvalidFile>()(
    "InvalidFile",
    {
        reason: Schema.String,
    },
) {}
