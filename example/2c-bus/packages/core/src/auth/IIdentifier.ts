import type { MemberDto } from "@expenses/contract/dto/MemberDto";
import type Unauthenticated from "@expenses/contract/errors/Unauthenticated";
import type { Result } from "better-result";

/** Turns a credential into the actor. How the credential works is the app's choice. */
export default interface IIdentifier {
    identify(token: string | null): Promise<Result<MemberDto, Unauthenticated>>;
}
