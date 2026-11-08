import type { MemberDto } from "@expenses/contract/dto/MemberDto";

export default interface IMemberRepository {
    findById(id: string): Promise<MemberDto | null>;
    findByToken(token: string): Promise<MemberDto | null>;
}
