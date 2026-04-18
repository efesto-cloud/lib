# @efesto-cloud/prisma-population

Prisma adapter for the [`@efesto-cloud/population`](../population) spec types. Turns a normalized populate spec into a Prisma `include` argument.

## Installation

```bash
pnpm add @efesto-cloud/prisma-population @efesto-cloud/population @prisma/client
```

## Exports

- `toPrismaInclude(spec)` — pure function: converts a `NormalizedPopulate<S>` into a Prisma `include` object (or `undefined` when empty).
- `BasePrismaPopulator<TShape>` — base class for entity-specific populators. Override `shape()` and optionally `field()` to customise per-relation behaviour.
- `PrismaInclude` — type alias for the recursive `include` shape.

## `toPrismaInclude`

```ts
import { toPrismaInclude } from "@efesto-cloud/prisma-population";
import { normalizePopulate } from "@efesto-cloud/population";

type PostShape = { author: true; comments: { author: true } };

const normalized = normalizePopulate(
    { author: true, comments: { author: true } },
    { author: true, comments: { author: true } } satisfies PostShape,
);

const include = toPrismaInclude(normalized);
// { author: true, comments: { include: { author: true } } }

await prisma.post.findUnique({ where: { id }, include });
```

`true` leaves stay `true`; nested specs become `{ include: { ... } }`. Entries set to `false` or `undefined` are dropped.

## `BasePrismaPopulator`

Use this when you want a single place to decide *which* relations an entity exposes and *how* each one is loaded.

```ts
import BasePrismaPopulator from "@efesto-cloud/prisma-population/BasePrismaPopulator";
import type { Populate } from "@efesto-cloud/population";

type PostShape = { author: true; comments: { author: true } };

export default class PostPopulator extends BasePrismaPopulator<PostShape> {
    static readonly SHAPE: PostShape = { author: true, comments: { author: true } };

    protected shape() {
        return PostPopulator.SHAPE;
    }

    static buildInclude(spec: Populate<PostShape> | undefined) {
        return new PostPopulator().build(spec);
    }
}

const include = PostPopulator.buildInclude({ comments: { author: true } });
await prisma.post.findMany({ include });
```

Override `field()` to inject per-relation options (`where`, `orderBy`, `take`, …) when `true`/plain `include` isn't enough.

## Related

- [`@efesto-cloud/population`](../population) — spec types and `normalizePopulate`.
- [`@efesto-cloud/prisma-database-context`](../prisma-database-context) — transactional Prisma client wrapper.
