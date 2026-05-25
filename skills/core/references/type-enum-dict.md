# Type / Enum / Dict

The three-file trio for constrained string fields. Lives across
`core/src/type/`, `core/src/enum/`, `core/src/dict/`.

## When to use this

Anywhere the domain has a finite, named set of values:

- Statuses (`"draft" | "published"`)
- Roles (`"admin" | "standard"`)
- Phases (`"prospect" | "commessa"`)
- Kinds, categories, severity levels, MIME-type groupings.

If the set is open (any string is valid) or extremely large (locale
codes, country codes — the type system isn't where you maintain
those), this trio isn't the right tool.

## The three files

### 1. The type — `core/src/type/T<Name>.ts`

Pure compile-time string union. No runtime presence.

```ts
// core/src/type/TFooStatus.ts
type TFooStatus = "draft" | "published";
export default TFooStatus;
```

Variants:

- **String union** — finite known values (as above).
- **Template literal** — for structured shapes (`SimpleDate =
  \`${number}-${number}-${number}\``).
- **Namespace-augmented** — when sub-groups of the union have
  meaning:

```ts
type TContentType = TContentType.Raster | TContentType.Vector;

namespace TContentType {
    export type Raster = "image/png" | "image/jpeg";
    export type Vector = "image/svg+xml";
}
export default TContentType;
```

Template literal types don't need an Enum or Desc — there are no
finite members to enumerate.

### 2. The enum — `core/src/enum/<Name>Enum.ts`

Runtime identity record where every key equals its value. Used when
you need to iterate, switch exhaustively at runtime, or hand a
sentinel value to external code.

```ts
// core/src/enum/FooStatusEnum.ts
import TFooStatus from "../type/TFooStatus.js";

const FooStatusEnum: Enum<TFooStatus> = {
    draft: "draft",
    published: "published",
};
export default FooStatusEnum;
```

`Enum<T>` is a project-wide utility type declared in
`core/global.d.ts`:

```ts
type Enum<T extends string> = { [K in T]: K };
```

You don't import it — it's ambient. The constraint forces every
member of `T` to appear once and prevents extras.

Iterate with `Object.values(FooStatusEnum)`:

```ts
const allStatuses: TFooStatus[] = Object.values(FooStatusEnum);
```

### 3. The dict — `core/src/dict/<Name>Desc.ts`

Maps every union member to a string label.

```ts
// core/src/dict/FooStatusDesc.ts
import TFooStatus from "../type/TFooStatus.js";
import FooStatusEnum from "../enum/FooStatusEnum.js";

const FooStatusDesc: Desc<TFooStatus> = {
    [FooStatusEnum.draft]: "Bozza",
    [FooStatusEnum.published]: "Pubblicato",
};
export default FooStatusDesc;
```

`Desc<T>` is the matching utility:

```ts
type Desc<T extends string> = { [K in T]: string };
```

Using `[FooStatusEnum.<key>]` as the computed key (rather than a
string literal) keeps the dict in sync with the type — if you rename
a member of the union, the dict's keys break the compile, not your
production page.

## Variants of the dict

| Purpose | File name | Key example |
|---------|-----------|-------------|
| Human-readable labels | `<Name>Desc.ts` | `MemberRoleDesc` |
| Map type → another value (icon, color, file extension) | `<Target>From<Source>.ts` | `ExtensionFromContentType` |

The naming signals direction. `ExtensionFromContentType` reads as
"give me the extension when I have a content type".

```ts
const ExtensionFromContentType: Desc<TContentType> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
};
export default ExtensionFromContentType;
```

## Sourcing the type from a DTO

If the type already exists as a property type on a DTO interface
(common when the field naturally belongs to a single entity), you can
skip the type file and import directly from the DTO:

```ts
import type IMember from "../dto/IMember.js";

const MemberRoleEnum: Enum<IMember["role"]> = {
    admin: "admin",
    standard: "standard",
};
```

In this codebase the convention leans toward the dedicated `type/`
file — easier to find, easier to import without dragging the DTO into
scope.

## Barrel exports

After creating a file, update its barrel:

```ts
// core/src/type/index.ts (type-only re-exports)
export type { default as TFooStatus } from "./TFooStatus.js";

// core/src/enum/index.ts (value re-exports)
export { default as FooStatusEnum } from "./FooStatusEnum.js";

// core/src/dict/index.ts (value re-exports)
export { default as FooStatusDesc } from "./FooStatusDesc.js";
```

`type/index.ts` is type-only because there are no runtime values to
export.

## Cross-layer: the trio is never injected

These are pure types and constants. They have **no DI symbols**, are
never bound to the container, and have no scope. They're imported
directly wherever they're used.

This trips people up the first time. The rule is: if it's a value
object, repository, service, or use case → DI. If it's a primitive
type, enum, dict, error class, or DTO → direct import.

## Decision guide

| Situation | Files to create |
|-----------|-----------------|
| Finite string values for a status / role / kind | T-type + Enum + Desc |
| Structured string shape (date, code pattern) | T-type only |
| Sub-groupable union | Namespaced T-type + Enum + Desc per group |
| Map each member to a non-label value | additional `<Target>From<Source>.ts` |

## Workflow

1. Decide if the set is truly finite and the type system should know.
2. Add the T-type.
3. Add the Enum (skip for template literals).
4. Add the Desc with labels (or value mapping).
5. Update the three barrels.
6. `pnpm -F @*/core typecheck` — the `Enum<T>` / `Desc<T>` constraints
   catch missing or extra members at compile time.

## Checklist — adding a new state field

- [ ] Decided on the finite set of values.
- [ ] `core/src/type/T<Name>.ts` created.
- [ ] `core/src/enum/<Name>Enum.ts` created (skip for template literals).
- [ ] `core/src/dict/<Name>Desc.ts` created with labels.
- [ ] All three barrels updated.
- [ ] Entity prop typed as the T-type.
- [ ] Typecheck passes.

## "Seen in the wild"

- `packages/core/src/type/MemberRole.ts` +
  `packages/core/src/enum/MemberRoleEnum.ts` +
  `packages/core/src/dict/MemberRoleDesc.ts` — full trio.
- `packages/core/src/type/CommessaStatus.ts` +
  `packages/core/src/enum/CommessaStatusEnum.ts` +
  `packages/core/src/dict/CommessaStatusDesc.ts` — same shape with
  more members.
