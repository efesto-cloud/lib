import Entity, { type EntityProps } from "@efesto-cloud/entity";
import { DateTime } from "luxon";
import type ILoginSession from "./ILoginSession.js";
import type ILoginSessionEntity from "./ILoginSessionEntity.js";

export interface LoginSessionProps extends EntityProps {
    issued_at: DateTime<true>;
    max_age: number;
    max_stale: number;
    // data: T;
}

/*
 issued_at          stale_at           expires_at
    +-------------------+-------------------+ - - - - - - - - 
    |       MAX AGE     |     MAX STALE     |     EXPIRED     
    +-------------------+-------------------+ - - - - - - - - 
    |                  TTL                  |                   
    +---------------------------------------+
*/

export default class LoginSession<
        P extends LoginSessionProps = LoginSessionProps,
        I = unknown,
    >
    extends Entity<P, I>
    implements ILoginSessionEntity<I>
{
    public static readonly MAX_AGE = { weeks: 2 };
    public static readonly MAX_STALE = { weeks: 2 };

    constructor(props: P, _id?: I, v?: number) {
        super(props, _id as I, v);
    }

    get issued_at() {
        return this.props.issued_at;
    }

    get max_age() {
        return this.props.max_age;
    }

    get max_stale() {
        return this.props.max_stale;
    }

    /* ----- COMPUTED PROPS ----- */

    get ttl() {
        return this.max_age + this.max_stale;
    }

    get stale_at(): DateTime<true> {
        return this.issued_at.plus({ seconds: this.max_age });
    }

    get expires_at(): DateTime<true> {
        return this.issued_at.plus({ seconds: this.ttl });
    }

    isFresh() {
        return DateTime.now() <= this.stale_at;
    }

    isExpired() {
        return DateTime.now() > this.expires_at;
    }

    isStale() {
        return !this.isFresh() && !this.isExpired();
    }

    get state() {
        if (this.isFresh()) return "FRESH";
        if (this.isExpired()) return "EXPIRED";
        return "STALE";
    }

    isLoggedIn() {
        return !this.deleted_at && !this.isExpired();
    }

    public touch() {
        switch (this.state) {
            case "FRESH":
                return;
            case "STALE":
                this.props.issued_at = DateTime.now();
                return;
            case "EXPIRED":
                this.delete();
                return;
        }
    }

    toDTO(): ILoginSession {
        return {
            _id: String(this._id),
            issued_at: this.issued_at.toISO(),
            max_age: this.max_age,
            max_stale: this.max_stale,
            ttl: this.ttl,
            stale_at: this.stale_at.toISO(),
            expires_at: this.expires_at.toISO(),
            state: this.state,
        };
    }
}
