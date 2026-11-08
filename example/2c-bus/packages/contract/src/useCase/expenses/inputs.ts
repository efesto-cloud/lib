import { z } from "zod";

export const ById = z.object({ expense_id: z.string() });
