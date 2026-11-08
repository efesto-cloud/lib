import { taggedError } from "./taggedError.js";

/** Anything the use case does not declare. No details cross the boundary. */
export default class InternalError extends taggedError("InternalError", {}) {}
