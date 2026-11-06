import type { Result } from "better-result";
import type { MemberDto } from "../dto/MemberDto.js";
import type Unauthenticated from "../errors/Unauthenticated.js";

/** Turns a credential into the actor. How the credential works is the app's choice. */
export default interface IIdentifier {
    identify(token: string | null): Promise<Result<MemberDto, Unauthenticated>>;
}
