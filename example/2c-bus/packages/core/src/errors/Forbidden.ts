import { z } from "zod";
import { taggedError } from "./taggedError.js";

export default class Forbidden extends taggedError("Forbidden", {
    policy: z.string(),
}) {}
