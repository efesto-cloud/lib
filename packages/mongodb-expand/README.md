# @efesto-cloud/mongodb-expand

MongoDB runtime for the [`@efesto-cloud/expand`](../expand) spec types. Ships:

- `BaseExpander` — builds a `$lookup`-based aggregation pipeline from a normalized expand spec.
- `QueryBuilder` — composes `$match` / `$set` / `$sort` / `$skip` / `$limit` and appends an expand pipeline in the right order.

## Installation

```bash
pnpm add @efesto-cloud/mongodb-expand @efesto-cloud/expand mongodb
```

## How it fits together

For each entity you want to expand, you write three small files:

1. **Shape** — which fields are expandable, and whether they're leaves or nested.
2. **Expander** — extends `BaseExpander`, turns a spec into `$lookup` stages.
3. **QueryBuilder** — extends `QueryBuilder`, exposes `expandWith(spec)` for repositories.

Then the repository composes a pipeline with the builder and runs `aggregate()`.

## `BaseExpander`

```ts
abstract class BaseExpander<TShape, TCollection extends string> {
    protected lookup(options: {
        from: TCollection;
        localField: string;
        foreignField: string;
        as: string;
        pipeline?: Document[];
    }): Document;

    protected unwind(path: string): Document;
    protected addStages(...stages: Document[]): void;

    protected markExpanded(field: string): boolean; // false if already expanded
    protected isExpanded(field: string): boolean;

    abstract expand(spec: NormalizedExpand<TShape>): this;

    build(): Document[];
}
```

### Example: flat expander

```ts
import { BaseExpander } from "@efesto-cloud/mongodb-expand";
import type { NormalizedExpand } from "@efesto-cloud/expand";

type PostShape = {
    author: true;    // 1:1, leaf
    comments: true;  // 1:many, leaf
};

export default class PostExpander extends BaseExpander<PostShape> {
    static readonly SHAPE: PostShape = { author: true, comments: true };

    private author() {
        if (!this.markExpanded("author")) return;
        this.addStages(
            this.lookup({
                from: "authors",
                localField: "author_id",
                foreignField: "_id",
                as: "author",
            }),
            this.unwind("author"), // 1:1 — flatten array
        );
    }

    private comments() {
        if (!this.markExpanded("comments")) return;
        this.addStages(
            this.lookup({
                from: "comments",
                localField: "_id",
                foreignField: "post_id",
                as: "comments",
            }),
            // No unwind — keep as array
        );
    }

    expand(spec: NormalizedExpand<PostShape>): this {
        if (spec.author) this.author();
        if (spec.comments) this.comments();
        return this;
    }

    static buildPipeline(spec: NormalizedExpand<PostShape>): Document[] {
        return new PostExpander().expand(spec).build();
    }
}
```

### Nested expansion

When a related entity itself has an expander, pass its pipeline as a sub-pipeline:

```ts
private author(nestedSpec: NormalizedExpand<AuthorShape>) {
    if (!this.markExpanded("author")) return;
    this.addStages(
        this.lookup({
            from: "authors",
            localField: "author_id",
            foreignField: "_id",
            as: "author",
            pipeline: AuthorExpander.buildPipeline(nestedSpec),
        }),
        this.unwind("author"),
    );
}
```

## `QueryBuilder`

```ts
class QueryBuilder<D extends Document, C extends string = string> {
    match(filter: Filter<D>): this;
    set(doc: Document): this;
    sort(spec: { [K in keyof D]?: 1 | -1 }): this;
    skip(n: number): this;
    limit(n: number): this;
    page(page?: number, pageSize?: number): this; // convenience: skip + limit
    build(): Document[];

    // protected — use from subclass to expose a typed expandWith()
    protected expand(lookup, { unwind }): this;
    protected push_expand_pipeline(pipeline: Document[]): this;
}
```

Stage order in `build()`: `$match` → `$set` → `$sort` → `$skip` → `$limit` → expand pipeline. Filters and pagination run before the joins so `$lookup` only runs against the final result set.

### Example: typed expand-aware builder

```ts
import QueryBuilder from "@efesto-cloud/mongodb-expand/QueryBuilder";
import { normalizeExpand, type Expand } from "@efesto-cloud/expand";
import PostExpander from "./PostExpander.js";
import type { PostShape } from "./PostShape.js";

export default class PostQueryBuilder extends QueryBuilder<PostDocument> {
    expandWith(fields: Expand<PostShape> = {}): this {
        const normalized = normalizeExpand(fields, PostExpander.SHAPE);
        const pipeline = PostExpander.buildPipeline(normalized);
        this.push_expand_pipeline(pipeline);
        return this;
    }
}
```

### Using it in a repository

```ts
async get(id: ObjectId, options?: { expand?: Expand<PostShape> }) {
    const pipeline = new PostQueryBuilder()
        .match({ _id: id })
        .expandWith(options?.expand)
        .limit(1)
        .build();

    const docs = await this.coll
        .aggregate<PostDocument>(pipeline, { session: this.uow.session })
        .toArray();

    return docs.length === 0 ? Maybe.none() : Maybe.maybe(PostMapper.from(docs[0]!));
}
```

## Rules of thumb

- **1:1 (FK on this entity)** — `lookup` + `unwind`.
- **1:many (FK on the related entity)** — `lookup` only, no `unwind`.
- **Array of FKs** — `lookup` with `localField` as the array field, no `unwind` (result is an array).
- **Optional FK** — `preserveNullAndEmptyArrays: true` is the default behaviour of `unwind()` here; map `doc.foo ? FooMapper.from(doc.foo) : null`.

## Related

- [`@efesto-cloud/expand`](../expand) — spec types and `normalizeExpand`.
