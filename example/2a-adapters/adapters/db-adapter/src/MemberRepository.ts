import { type IMemberRepository, type MemberDto, Port } from "@expenses/core";
import { inject, injectable } from "inversify";
import type Database from "./Database.js";

@injectable()
export default class MemberRepository implements IMemberRepository {
    constructor(@inject(Port.Database) private readonly db: Database) {}

    async findById(id: string) {
        return (this.db.conn
            .prepare("select id, name, email, role from member where id = ?")
            .get(id) ?? null) as MemberDto | null;
    }

    async findByToken(token: string) {
        return (this.db.conn
            .prepare("select id, name, email, role from member where token = ?")
            .get(token) ?? null) as MemberDto | null;
    }
}
