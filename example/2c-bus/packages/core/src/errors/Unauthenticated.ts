import { Schema } from "effect";

export default class Unauthenticated extends Schema.TaggedError<Unauthenticated>()(
    "Unauthenticated",
    {},
) {}
