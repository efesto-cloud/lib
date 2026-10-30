import type { MemberDto } from "../dto/MemberDto.js";

export default interface IMemberRepository {
    findById(id: string): Promise<MemberDto | null>;
    findByToken(token: string): Promise<MemberDto | null>;
}
