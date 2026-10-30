import type { MemberDto } from "./dto/MemberDto.js";

declare module "@efesto-cloud/usecase" {
    interface IExecutionContext {
        /** Who performs the operation. There are no anonymous calls. */
        actor: MemberDto;
    }
}
