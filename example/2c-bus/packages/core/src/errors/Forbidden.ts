import { Schema } from "effect";

export default class Forbidden extends Schema.TaggedError<Forbidden>()(
    "Forbidden",
    {
        policy: Schema.String,
    },
) {}
