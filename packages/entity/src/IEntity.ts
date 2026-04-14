import type { DateTime } from "luxon";

export default interface IEntity<I = unknown> {
    readonly _id: I;
    readonly v: number | null;
    readonly deleted_at: DateTime<true> | null;

    delete(): void;
    restore(): void;

    isNew(): this is this & { v: 0 };
    isUpdated(): this is this & { v: number };
    isDeleted(): this is this & { deleted_at: DateTime<true> };
}
