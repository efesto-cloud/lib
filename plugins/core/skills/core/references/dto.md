# DTO

Public data shapes that cross layer boundaries. Lives in
`core/src/dto/`. The single home for serialised representations of
entities and for use-case input/response shapes that are big enough
to deserve a name.

## What a DTO is (and isn't)

- **Is**: a TypeScript interface with primitive members. Marshalled
  to JSON over the wire, persisted to storage, displayed in templates.
- **Isn't**: an entity. DTOs have no methods, no validation, no
  identity beyond `_id`.

A DTO is the contract; the entity is the implementation. The same DTO
shape may be produced by the domain (`entity.toDTO()`) and consumed by
adapters (route loader returning JSON, mapper writing a DB row in some
projects).

## File and naming

```
core/src/dto/<Entity>Dto.ts          — e.g. MemberDto.ts
core/src/dto/index.ts                — type-only re-export
```

Naming variants you might encounter:

- `<Entity>Dto.ts` — current convention in `task-planning`.
- `I<Entity>.ts` — older convention, still widely used in other
  projects (e.g. `IMember.ts`). Match the project you're in.

Members are `snake_case`. This makes the DTO compatible with database
column names and JSON payloads, which usually follow the same
convention.

## The canonical shape

```ts
// core/src/dto/FooDto.ts
import type TFooStatus from "~/type/TFooStatus.js";

interface FooDto {
    _id: string;                         // identity, always string
    name: string;                        // VO serialised
    status: TFooStatus;                  // string-union type from core/src/type/
    parent_id: string | null;            // FK as string
    created_at: string;                  // ISO string
    updated_at: string;
    deleted_at: string | null;
}

export default FooDto;
```

Rules:

- **`_id: string`** always. ObjectIds → hex string; UUIDs → string.
- **Foreign keys** end in `_id` and are typed as `string` (or `string
  | null` if nullable).
- **`DateTime`** → `string` (ISO 8601). Nullable → `string | null`.
- **Value objects** → their primitive `toRaw()` form. `EmailAddress`
  becomes `string`. `Money` becomes its `IMoney` interface.
- **Nested DTOs** → the nested DTO interface. `parent?: ParentDto |
  null` when the field is populated, else omit.
- **Arrays** → arrays of DTOs.
- **No methods.** No validation. No `class`.

## Type-only export

DTOs are imported as types only:

```ts
// core/src/dto/index.ts
export type { default as FooDto } from "./FooDto.js";
```

`server.ts` re-exports the whole barrel. `client.ts` also re-exports
DTOs so the browser bundle can pull them without dragging server
code.

Consumers import like:

```ts
import type { FooDto } from "@task-management/core";
import type { FooDto } from "@task-management/core/client";  // same thing
```

## DTO unions (discriminated)

When the entity is a union, the DTO mirrors the discriminant:

```ts
type FooDto = AlphaFooDto | BetaFooDto;

interface AlphaFooDto {
    _id: string;
    kind: "alpha";
    alpha_field: string;
    // common fields
}

interface BetaFooDto {
    _id: string;
    kind: "beta";
    beta_field: number;
    // common fields
}
```

Clients narrow on `kind`:

```ts
function render(foo: FooDto) {
    if (foo.kind === "alpha") return <Alpha foo={foo} />;
    return <Beta foo={foo} />;
}
```

## Use-case input/response DTOs — where do they live?

Two patterns coexist:

1. **Inline with the use case interface** — when the input/response
   are use-case-specific and won't be reused:

```ts
// core/src/useCase/foos/ICreateFooUseCase.ts
export interface CreateFooInputDto {
    name: string;
    status?: TFooStatus;
}

interface ICreateFooUseCase
    extends IUseCase<CreateFooInputDto, Result<FooDto, DomainError>> {}

export default ICreateFooUseCase;
```

This is the dominant pattern. Keep the input shape next to the
interface that defines it.

2. **In `core/src/dto/`** — when the shape is genuinely shared (e.g.
   pagination filter shapes used across `list` use cases).

Don't pre-emptively promote use-case-specific shapes to `dto/` just
because they have multiple fields. Wait for actual reuse.

## Marshalling — who turns an entity into a DTO?

The entity, via `toDTO()`:

```ts
// inside Foo
toDTO(): FooDto {
    return {
        _id: this._id,
        name: this.props.name.toRaw(),
        status: this.props.status,
        parent_id: this.props.parent_id,
        created_at: this.props.created_at.toISO() ?? "",
        updated_at: this.props.updated_at.toISO() ?? "",
        deleted_at: this.deleted_at?.toISO() ?? null,
    };
}
```

The use case returns `Result<FooDto, DomainError>` — not the entity:

```ts
async execute(input): Promise<Result<FooDto, DomainError>> {
    const created = Foo.create(...);
    if (created.isFailure()) return Result.err(created.error);
    await this.fooRepo.save(created.data);
    return Result.ok(created.data.toDTO());
}
```

Why return a DTO and not the entity?

- The route loader/action serialises the result to JSON. DTOs are
  already JSON-shaped; entities aren't.
- The client bundle includes the DTO type but never the entity class
  (which would drag in Luxon, the Entity base class, etc.).
- The DTO defines a contract; the entity is an implementation detail
  that can evolve independently.

## DTO ↔ DB row

The DTO is **not** the same as the DB row.

- **DTO** — public, ISO strings for dates, value objects serialised,
  used in JSON.
- **DB row** — the chosen database's native record type (a Prisma
  generated payload, a hand-written MongoDB `Document`, a Drizzle
  inferred row, …), JS `Date` for dates, raw primitives, used in
  storage.

The mapper sits between them:

```
DB row  ──FooMapper.from()──→  Foo entity  ──.toDTO()──→  FooDto
DB row  ←──FooMapper.to()──────  Foo entity  ←──Foo.create(input)──── DTO/input
```

If you're tempted to write a `dtoFromRow(row): FooDto` shortcut,
resist — you'd be inlining the mapper. Always go through the entity.

## Validation

DTOs themselves do no validation. The route loader/action validates
the **input** before constructing a use-case input (via Zod, or hand-
rolled type-guards). The use case trusts its input has the right
TypeScript type but still runs domain validation via the entity's
`create()` / mutators.

## Cross-layer: where DTOs touch each layer

- **Entity**: produces `FooDto` via `toDTO()`.
- **Mapper**: doesn't touch DTOs directly. Mapper ↔ row, entity ↔ DTO.
- **Repository port**: returns entities, not DTOs.
- **Use case**: takes an input DTO (often `CreateFooInputDto`),
  returns a domain DTO (`FooDto`) wrapped in `Result`.
- **Route loader/action**: input → use-case input → execute → DTO →
  JSON response.
- **React components / client code**: import `FooDto` as type only.

## Checklist — new DTO

- [ ] File `core/src/dto/<Entity>Dto.ts` created.
- [ ] All members `snake_case`.
- [ ] `_id: string`.
- [ ] Dates as `string` or `string | null`.
- [ ] VOs as their `toRaw()` primitives.
- [ ] No methods, no `class`, no validation logic.
- [ ] Type-only re-export from `core/src/dto/index.ts`.

## "Seen in the wild"

- `packages/core/src/dto/MemberDto.ts`,
- `packages/core/src/dto/PraticaDto.ts`,
- `packages/core/src/dto/TimesheetEntryDto.ts`.
