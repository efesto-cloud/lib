import { Result } from "effect";
import { inject, injectable } from "inversify";
import { Port } from "../di/Port.js";
import Unauthenticated from "../errors/Unauthenticated.js";
import type IMemberRepository from "../repo/IMemberRepository.js";
import type IIdentifier from "./IIdentifier.js";

@injectable()
export default class Identifier implements IIdentifier {
    constructor(
        @inject(Port.MemberRepository)
        private readonly members: IMemberRepository,
    ) {}

    async identify(token: string | null) {
        const member = token ? await this.members.findByToken(token) : null;
        return member
            ? Result.succeed(member)
            : Result.fail(new Unauthenticated());
    }
}
