import { TaggedError } from "better-result";

/**
 * Qualcun altro ha scritto gli stessi dati nello stesso momento, e la
 * ripetizione non è bastata.
 */
export default class ConflictError extends TaggedError("ConflictError") {}
