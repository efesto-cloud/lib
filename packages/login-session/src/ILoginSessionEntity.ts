import type { IEntity } from "@efesto-cloud/entity";
import type { DateTime } from "luxon";
import type TLoginSessionState from "./TLoginSessionState.js";

export default interface ILoginSessionEntity<I = unknown> extends IEntity<I> {
    issued_at: DateTime;
    max_age: number;
    max_stale: number;

    ttl: number;
    stale_at: DateTime;
    expires_at: DateTime;

    isFresh(): boolean;
    isExpired(): boolean;
    isStale(): boolean;
    state: TLoginSessionState;

    isLoggedIn(): boolean;

    touch(): void;
}
