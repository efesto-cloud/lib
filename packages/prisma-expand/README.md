# @efesto-cloud/prisma-expand

Prisma adapter for the [`@efesto-cloud/expand`](../expand) spec types. Turns a normalized expand spec into a Prisma `include` argument.

## Installation

```bash
pnpm add @efesto-cloud/prisma-expand @efesto-cloud/expand @prisma/client
```

## Exports

- `toPrismaInclude(spec)` — pure function: converts a `NormalizedExpand<S>` into a Prisma `include` object (or `undefined` when empty).
- `BasePrismaExpander<TShape>` — base class for entity-specific expanders. Override `shape()` and optionally `field()` to customise per-relation behaviour.
- `PrismaInclude` — type alias for the recursive `include` shape.

## `toPrismaInclude`

```ts
import { toPrismaInclude } from "@efesto-cloud/prisma-expand";
import { normalizeExpand } from "@efesto-cloud/expand";

type PostShape = { author: true; comments: { author: true } };

const normalized = normalizeExpand(
    { author: true, comments: { author: true } },
    { author: true, comments: { author: true } } satisfies PostShape,
);

const include = toPrismaInclude(normalized);
// { author: true, comments: { include: { author: true } } }

await prisma.post.findUnique({ where: { id }, include });
```

`true` leaves stay `true`; nested specs become `{ include: { ... } }`. Entries set to `false` or `undefined` are dropped.

## `BasePrismaExpander`

Use this when you want a single place to decide *which* relations an entity exposes and *how* each one is loaded.

```ts
import BasePrismaExpander from "@efesto-cloud/prisma-expand/BasePrismaExpander";
import type { Expand } from "@efesto-cloud/expand";

type PostShape = { author: true; comments: { author: true } };

export default class PostExpander extends BasePrismaExpander<PostShape> {
    static readonly SHAPE: PostShape = { author: true, comments: { author: true } };

    protected shape() {
        return PostExpander.SHAPE;
    }

    static buildInclude(spec: Expand<PostShape> | undefined) {
        return new PostExpander().build(spec);
    }
}

const include = PostExpander.buildInclude({ comments: { author: true } });
await prisma.post.findMany({ include });
```

Override `field()` to inject per-relation options (`where`, `orderBy`, `take`, …) when `true`/plain `include` isn't enough.

## Related

- [`@efesto-cloud/expand`](../expand) — spec types and `normalizeExpand`.
- [`@efesto-cloud/prisma-unit-of-work`](../prisma-unit-of-work) — transactional Prisma client wrapper.
