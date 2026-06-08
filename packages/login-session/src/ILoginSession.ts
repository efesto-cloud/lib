import type TLoginSessionState from "./TLoginSessionState.js";

export default interface ILoginSession {
    _id: string;

    /**
     * Maximum amount of seconds after "issued_at" that it will be considered "Fresh".
     * After that, it will be considered "Stale" or if "max_stale" is 0, it will be considered "Expired".
     */
    max_age: number;
    /**
     * Maximum amount of seconds after "issued_at" + "MaxAge" that it will be considered "Stale".
     * After that, it will be considered "Expired".
     */
    max_stale: number;
    /**
     * It's the sum of "MaxAge" + "Stale".
     * After that, it will be considered "Expired".
     */
    ttl: number;
    /**
     * ISO8601 date when the session was issued.
     * It's the current date when the session is created.
     * It's the date when the session is refreshed.
     */
    issued_at: string;
    /**
     * ISO8601 date when the session will be considered "Stale".
     * It's computed from "issued_at" + "MaxAge"
     */
    stale_at: string;
    /**
     * ISO8601 date when the session will be considered "Expired".
     * It's the sum of "issued_at" + "MaxAge" + "Stale"
     * After that it can be deleted.
     */
    expires_at: string;

    state: TLoginSessionState;

    /**
     * The data of the session.
     */
    // data: T
}
