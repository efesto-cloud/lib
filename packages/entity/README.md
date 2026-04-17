# @efesto-cloud/entity

Base `Entity` class for domain objects in a hexagonal architecture: carries typed props, a primary id, a version counter, and a soft-delete flag. Ships with small mapper interfaces for entity ↔ DTO and value-object ↔ DTO conversions.

## Installation

```bash
pnpm add @efesto-cloud/entity luxon
```

## Quick Start

```ts
import Entity, { IEntity } from "@efesto-cloud/entity";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

type PostProps = {
    title: string;
    body: string;
    deleted_at: DateTime<true> | null;
};

export interface IPost {
    _id: string;
    title: string;
    body: string;
    deleted_at: string | null;
}

export default class Post extends Entity<PostProps, ObjectId> {
    constructor(props: PostProps, id?: ObjectId) {
        super(props, new ObjectId(id));
    }

    get title() { return this.props.title; }
    get body()  { return this.props.body; }

    rename(title: string) {
        this.props.title = title;
    }

    toDTO(): IPost {
        return {
            _id: this._id.toHexString(),
            title: this.props.title,
            body: this.props.body,
            deleted_at: this.deleted_at?.toISO() ?? null,
        };
    }

    static create(props: Partial<PostProps> = {}, id?: ObjectId) {
        return new Post({
            title: props.title ?? "",
            body: props.body ?? "",
            deleted_at: props.deleted_at ?? null,
        }, id);
    }
}
```

## What `Entity` gives you

```ts
abstract class Entity<T extends EntityProps, I = unknown> implements IEntity<I> {
    readonly props: T;
    readonly _id: I;

    get v(): number;                        // optimistic-concurrency version
    get deleted_at(): DateTime<true> | null;

    delete(): void;    // sets deleted_at = now
    restore(): void;   // clears deleted_at

    isNew(): this is this & { v: 0 };
    isUpdated(): this is this & { v: number };
    isDeleted(): this is this & { deleted_at: DateTime<true> };
}
```

`EntityProps` is a `Record<string, unknown>` that optionally carries `deleted_at: DateTime<true> | null` — pick it up automatically if your props extend it.

## Mappers

Two small interfaces for the persistence boundary:

```ts
interface IEntityMapper<E extends IEntity, RAW> {
    from(dto: RAW): E;
    to<P extends keyof RAW = keyof RAW>(entity: E, options?: { pick?: P[] }): Pick<RAW, P>;
}

interface IValueObjectMapper<E extends object, RAW> {
    from(dto: RAW): E;
    to<P extends keyof RAW = keyof RAW>(vo: E, options?: { pick?: P[] }): Pick<RAW, P>;
}
```

Implementations live in the persistence layer (see [`@efesto-cloud/mongodb-population`](../mongodb-population) and the project's `src/mapper/` directory).

## Conventions

These are the conventions used across efesto-cloud projects — the `entity` skill enforces them.

**DTO interface** (public serialization contract):

- All properties `snake_case`.
- Primary key: `_id: string`.
- Foreign keys: `parent_id`, `author_id`, …
- `DateTime` → `string` (ISO); nullable → `string | null`.
- No methods, no business logic; only native types.

**Entity class:**

- Constructor always wraps the id: `super(props, new ObjectId(id))` — even if the caller already passed an `ObjectId`.
- Never instantiate from outside — always go through a `static create()` factory.
- `create()` params are optional with `??` defaults; only strictly required business fields are mandatory.
- Getters for every prop; add setters only when there is a business operation behind them.
- `toDTO()` must cover every DTO field, converting ids and `DateTime` to strings.
- Soft deletes: `deleted_at: DateTime<true> | null` in props, use `delete()` / `restore()` from the base class.

**Business methods:**

- Return `Result<T, Error>` for fallible operations, `void` for infallible mutations.
- Push logic into the entity whenever it can be expressed purely from the entity's own fields. Anything that loads or saves belongs in a use case.

For the full pattern (including unions/polymorphic entities), see the `entity` skill in `.claude/skills/entity`.
