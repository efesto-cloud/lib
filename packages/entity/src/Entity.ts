import { DateTime } from "luxon";
import type IEntity from "./IEntity.js";

export type EntityProps = Record<string, unknown> & {
    deleted_at?: DateTime<true> | null;
};

export default abstract class Entity<
    T extends EntityProps = Record<string, never>,
    I = unknown,
> implements IEntity<I>
{
    public readonly props: T;
    public readonly _id: I;

    private _v: number;
    private _deleted_at: DateTime<true> | null;

    constructor(props: T, _id: I);
    constructor(props: T, _id: I, version: number);
    constructor(props: T, _id: I, version?: number);
    constructor(props: T, _id: I, version?: number) {
        this.props = props;
        this._id = _id;
        this._deleted_at = props.deleted_at ?? null;
        this._v = version ?? 0;
    }

    get deleted_at() {
        return this._deleted_at;
    }

    get v() {
        return this._v;
    }

    delete() {
        this._deleted_at = DateTime.now();
    }

    restore() {
        this._deleted_at = null;
    }

    isNew(): this is this & { v: 0 } {
        return this._v === 0;
    }

    isUpdated(): this is this & { v: number } {
        return this._v !== 0;
    }

    isDeleted(): this is this & { deleted_at: DateTime<true> } {
        return this._deleted_at !== null;
    }
}
