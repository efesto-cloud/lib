import { z } from "zod";
import { taggedError } from "./taggedError.js";

export default class ImportRowInvalid extends taggedError("ImportRowInvalid", {
    row: z.number(),
    reason: z.string(),
}) {}
