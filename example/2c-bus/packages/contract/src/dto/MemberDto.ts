import { z } from "zod";
import { ROLES } from "../type/Role.js";

export const MemberDto = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.enum(ROLES),
});

export type MemberDto = z.infer<typeof MemberDto>;
