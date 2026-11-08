import type { MemberDto } from "@expenses/contract/dto/MemberDto";
import type IMemberRepository from "@expenses/core/repo/IMemberRepository";
import type StubStore from "./StubStore.js";

export default class InMemoryMemberRepository implements IMemberRepository {
    constructor(private readonly store: StubStore) {}

    async findById(id: string) {
        const row = this.store.state.members.get(id);
        return row ? toDto(row) : null;
    }

    async findByToken(token: string) {
        const row = [...this.store.state.members.values()].find(
            (m) => m.token === token,
        );
        return row ? toDto(row) : null;
    }
}

function toDto({
    token: _,
    ...member
}: MemberDto & { token: string }): MemberDto {
    return member;
}
