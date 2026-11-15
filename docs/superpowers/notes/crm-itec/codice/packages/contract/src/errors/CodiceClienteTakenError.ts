import { TaggedError } from "better-result";

export default class CodiceClienteTakenError extends TaggedError(
    "CodiceClienteTakenError",
) {}
