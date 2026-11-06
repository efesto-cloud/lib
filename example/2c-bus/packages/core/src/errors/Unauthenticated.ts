import { taggedError } from "./taggedError.js";

export default class Unauthenticated extends taggedError(
    "Unauthenticated",
    {},
) {}
