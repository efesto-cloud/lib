import { Schema } from "effect";
import { ROLES } from "../type/Role.js";

export const MemberDto = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    role: Schema.Literals(ROLES),
});

export type MemberDto = typeof MemberDto.Type;
