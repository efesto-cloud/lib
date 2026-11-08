import { z } from "zod";
import { taggedError } from "./taggedError.js";

export default class InvalidAmount extends taggedError("InvalidAmount", {
    amount_cents: z.number(),
}) {}
