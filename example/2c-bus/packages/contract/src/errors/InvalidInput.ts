import { z } from "zod";
import { taggedError } from "./taggedError.js";

/** Input that does not match the use case's schema. */
export default class InvalidInput extends taggedError("InvalidInput", {
    issue: z.string(),
}) {}
