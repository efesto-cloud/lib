# Entity

How to write an Entity + DTO pair with `@efesto-cloud/entity`. The
canonical home for entity construction conventions in this codebase.

## What an entity is

A domain entity is a class that:

- Has an identity (`_id`) and lifecycle (`created_at`, `updated_at`,
  `deleted_at`).
- Holds invariants. Operations that violate the invariants return
  `Result.err(...)`, they don't throw.
- Has no knowledge of persistence, transport, or DI.

The `@efesto-cloud/entity` base class handles the lifecycle plumbing
so subclasses can focus on domain rules.

## Files for a new entity

```
core/src/entity/Foo.ts        — the class
core/src/dto/FooDto.ts        — its DTO interface (see dto.md)
core/src/entity/index.ts      — barrel: re-export Foo
core/src/dto/index.ts         — barrel: re-export FooDto (type-only)
```

## The `Entity<Props, Id>` base class

```ts
import Entity, { type IEntity } from "@efesto-cloud/entity";

class Foo extends Entity<FooProps, string> implements IEntity<string> {
    constructor(props: FooProps, id?: string) {
        super(props, id ?? randomUUID());
    }
}
```

Two generic parameters:

- **`Props`** — your private props bag (`FooProps`).
- **`Id`** — the id type. Usually `string` (UUID or cuid). MongoDB
  codebases use `ObjectId`; pass `ObjectId` instead.

Inherited members you should *not* redefine:

| Member | Type | Meaning |
|--------|------|---------|
| `_id` | `Id` | Identity. Read-only. |
| `v` | `number \| null` | Version. `0` for new (unsaved); `> 0` after first persist. |
| `deleted_at` | `DateTime<true> \| null` | Soft-delete timestamp. |
| `isNew()` | `() => boolean` | `true` when `v === 0`. |
| `isUpdated()` | `() => boolean` | `true` when `v !== 0`. |
| `isDeleted()` | `() => boolean` | `true` when `deleted_at !== null`. |
| `delete()` | `() => void` | Sets `deleted_at` to now. |
| `restore()` | `() => void` | Sets `deleted_at` to `null`. |

`this.props` is your protected access point to the props bag.

## The props type

```ts
type FooProps = {
    name: FooName;                  // value object, not string
    status: TFooStatus;             // string-union from core/src/type/
    parent_id: string | null;       // foreign keys stay primitive
    created_at: DateTime;
    updated_at: DateTime;
    deleted_at: DateTime<true> | null;
};
```

Rules:

- **Use value objects, not raw primitives**, for fields that have
  validation rules. `EmailAddress` not `string`, `Money` not `number`,
  `FooName` not `string` (if its bounds matter).
- **Use string-union types** from `core/src/type/` for constrained
  string fields (`role`, `status`, `kind`).
- **Foreign keys stay primitive** — `parent_id: string | null`. The
  entity doesn't hold the parent; that's the population layer's job
  if needed.
- **Timestamps are Luxon `DateTime`s.** `created_at` / `updated_at`
  are non-null after creation; `deleted_at` is `DateTime<true> | null`
  (the `<true>` is Luxon's "valid timezone" brand).

## Constructor — direct construction is for the mapper

```ts
constructor(props: FooProps, id?: string) {
    super(props, id ?? randomUUID());
}
```

The constructor accepts already-validated props. **Never call `new
Foo(...)` from outside the entity, the mapper, or in `create()`**.
Application code goes through `Foo.create(...)`; the mapper goes
through `new Foo(...)` because it has already-validated stored state
from the DB.

If your project uses `ObjectId`s, wrap them defensively:

```ts
constructor(props: FooProps, id?: ObjectId) {
    super(props, new ObjectId(id));  // tolerates string, ObjectId, undefined
}
```

## Getters

One getter per prop, no setters. Mutation goes through business
methods.

```ts
get name(): FooName { return this.props.name; }
get status(): TFooStatus { return this.props.status; }
get created_at(): DateTime { return this.props.created_at; }
get updated_at(): DateTime { return this.props.updated_at; }
```

`deleted_at` is exposed by the base class — don't override.

## Business methods — `Result<void, DomainError>`

Mutator methods return `Result<void, DomainError>` so callers know
they might fail.

```ts
rename(input: string, clock: IClock): Result<void, DomainError> {
    const next = FooName.create(input);
    if (next.isFailure()) return Result.err(next.error);
    this.props.name = next.data;
    this._touch(clock);
    return Result.ok(undefined);
}
```

Infallible mutators may return `void`. Don't pad with
`Result<void, never>` for the sake of consistency — the type adds
noise.

```ts
publish(clock: IClock): void {
    this.props.status = "published";
    this._touch(clock);
}
```

`_touch(clock)` bumps `updated_at`:

```ts
private _touch(clock: IClock): void {
    this.props.updated_at = clock.now();
}
```

The clock is passed in because the entity should not depend on
global `DateTime.now()` — making time injectable lets tests run
against a fixed clock.

## `toDTO()` — serialisation contract

```ts
toDTO(): FooDto {
    return {
        _id: this._id,                                    // identity
        name: this.props.name.toRaw(),                    // VO → primitive
        status: this.props.status,
        parent_id: this.props.parent_id,
        created_at: this.props.created_at.toISO() ?? "",
        updated_at: this.props.updated_at.toISO() ?? "",
        deleted_at: this.deleted_at?.toISO() ?? null,
    };
}
```

Rules:

- Every field in `FooDto` is filled — no missing keys.
- Value objects go through `.toRaw()`.
- `DateTime`s go through `.toISO()` and fall back to `""` if
  somehow invalid (`toISO()` returns `string | null`).
- Nested entities use their own `toDTO()`.
- Arrays of entities map: `items: this.props.items.map(i => i.toDTO())`.

## `static create(...)` — the validated factory

```ts
static create(
    props: {
        name: string;
        status?: TFooStatus;
        parent_id?: string | null;
        created_at?: DateTime;
        updated_at?: DateTime;
        deleted_at?: DateTime<true> | null;
    },
    clock: IClock,
    id?: string,
): Result<Foo, DomainError> {
    const name = FooName.create(props.name);
    if (name.isFailure()) return Result.err(name.error);

    const now = clock.now();
    return Result.ok(new Foo({
        name: name.data,
        status: props.status ?? "draft",
        parent_id: props.parent_id ?? null,
        created_at: props.created_at ?? now,
        updated_at: props.updated_at ?? now,
        deleted_at: props.deleted_at ?? null,
    }, id));
}
```

Rules:

- Returns `Result<Foo, DomainError>`. Never throws.
- Required props are required at the call site; optional props default
  with `??` (e.g. `props.status ?? "draft"`).
- Value objects are built via their own `create()` — propagate the
  failure if the input is invalid.
- `created_at` / `updated_at` default to `clock.now()` — but the
  signature allows overrides because mappers may use this path with
  the DB's stored timestamps (rare; usually mappers use `new Foo(...)`
  with pre-built `DateTime`s).
- Always pass `id` last and let the constructor handle `undefined`.

## Soft-delete

Use the inherited `delete()` / `restore()` methods directly. A
use case looks like:

```ts
async execute(input): Promise<Result<void, DomainError>> {
    const target = await this.fooRepo.findById(input.foo_id);
    if (!target) return Result.err(new FooNotFoundError());
    if (target.isDeleted()) return Result.ok(undefined);    // idempotent

    target.delete();
    await this.fooRepo.save(target);
    return Result.ok(undefined);
}
```

Restore mirrors it with `findById(id, { includeDeleted: true })` and
`target.restore()`.

## Audit fields

If the entity records who mutated it:

```ts
type FooProps = BaseProps & {
    // ...
    updated_by: MemberDto | null;
};

rename(input: string, actor: MemberDto, clock: IClock): Result<void, DomainError> {
    // ... validation
    this.props.updated_by = actor;
    this._touch(clock);
    return Result.ok(undefined);
}
```

The actor is a DTO, not the `Member` entity. The actor doesn't need to
mutate anything; the DTO is sufficient and avoids dragging the full
entity into the persisted payload.

## Union entity pattern

When a single concept has multiple kinds (e.g. `Pratica` = `Prospect |
Commessa`), use a discriminated union:

```ts
type FooProps = { kind: "alpha"; alphaField: string }
              | { kind: "beta"; betaField: number };

class Foo extends Entity<FooProps, string> {
    get kind(): "alpha" | "beta" { return this.props.kind; }

    // narrow inside methods via discriminant check:
    promote(clock: IClock): Result<void, DomainError> {
        if (this.props.kind !== "alpha") return Result.err(new InvalidStateError());
        // now props is narrowed to the "alpha" variant
        this.props = { kind: "beta", betaField: 0 };
        this._touch(clock);
        return Result.ok(undefined);
    }
}
```

The DTO mirrors the discriminant (`type: "alpha" | "beta"`) so
clients can switch on it. See `dto.md` for the DTO side.

## Cross-layer: how value objects are consumed

The entity is the boundary between "raw input" and "validated props".
The flow:

```
Raw input (string)                    UC.execute(input)
        │
        ▼
Foo.create({ name: input.name })
        │
        ▼
FooName.create(input.name)            VO factory validates
        │
        ▼
new Foo({ name: validatedFooName })   props are typed as VO
        │
        ▼
foo.toDTO().name = vo.toRaw()         serialised back to primitive
```

The mapper's `from()` does the same flow in reverse: pull the
primitive from the DB row, run `FooName.create(...)` (throw on
failure because a corrupt DB is an ops issue), and pass the VO to
`new Foo(...)`.

## Cross-layer: how the use case decides between `create()` and direct construction

- **Use case constructing a brand-new entity from user input** →
  `Foo.create(...)`.
- **Use case mutating an entity returned by a repo** → call the
  entity's own mutator method (`foo.rename(...)`); the entity is
  already valid.
- **Mapper reconstructing from a DB row** → `new Foo(...)` with
  already-built props (because the DB row is trusted as already-
  validated stored state).
- Never call `new Foo(...)` from a use case.

## Cross-layer: how the mapper reconstructs an entity

See `prisma-persistence.md` for the full Prisma mapper, but in
essence:

```ts
const FooMapper: IEntityMapper<Foo, FooRow> = {
    from: (row) => {
        const name = FooName.create(row.name);
        if (name.isFailure()) throw new Error(`Invalid name in DB for Foo ${row.id}`);
        return new Foo({
            name: name.data,
            status: row.status as TFooStatus,
            created_at: DateTime.fromJSDate(row.created_at),
            updated_at: DateTime.fromJSDate(row.updated_at),
            deleted_at: row.deleted_at
                ? (DateTime.fromJSDate(row.deleted_at) as DateTime<true>)
                : null,
        }, row.id);
    },
    to: (foo) => ({
        id: foo._id,
        name: foo.name.toRaw(),
        status: foo.status,
        created_at: foo.created_at.toJSDate(),
        updated_at: foo.updated_at.toJSDate(),
        deleted_at: foo.deleted_at?.toJSDate() ?? null,
    }),
};
```

The asymmetry: `from()` may throw on corrupt data; `to()` never can —
the entity's invariants guarantee validity.

## Checklist — new entity

- [ ] `FooProps` type uses value objects for validated fields.
- [ ] Class extends `Entity<FooProps, string>` (or `ObjectId`).
- [ ] Constructor accepts `(props, id?)` and calls `super(props, id ?? randomUUID())`.
- [ ] One getter per prop. No setters.
- [ ] Mutator methods return `Result<void, DomainError>` (or `void` if infallible).
- [ ] `_touch(clock)` private method bumps `updated_at`.
- [ ] `toDTO()` covers every DTO field; VOs go through `.toRaw()`,
      `DateTime`s through `.toISO()`.
- [ ] `static create()` returns `Result<Foo, DomainError>`, validates
      via VO factories, defaults timestamps via `clock`.
- [ ] Exported from `core/src/entity/index.ts`.
- [ ] DTO created (see `dto.md`).

## "Seen in the wild"

- `packages/core/src/entity/Member.ts` — full example with two VOs
  (`EmailAddress`, `PasswordHash`), code-normalisation invariant,
  audit timestamps, soft-delete.
- `packages/core/src/entity/TimesheetEntry.ts` — date-range validation
  in `create()`; multiple mutator methods.
- `packages/core/src/entity/Pratica.ts` — discriminated-union pattern
  with `Prospect` / `Commessa` variants.
