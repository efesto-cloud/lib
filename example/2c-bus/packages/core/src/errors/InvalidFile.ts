import { z } from "zod";
import { taggedError } from "./taggedError.js";

export default class InvalidFile extends taggedError("InvalidFile", {
    reason: z.string(),
}) {}
