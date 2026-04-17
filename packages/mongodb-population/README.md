# @efesto-cloud/mongodb-population

MongoDB runtime for the [`@efesto-cloud/population`](../population) spec types. Ships:

- `BasePopulator` — builds a `$lookup`-based aggregation pipeline from a normalized populate spec.
- `QueryBuilder` — composes `$match` / `$set` / `$sort` / `$skip` / `$limit` and appends a populate pipeline in the right order.

## Installation

```bash
pnpm add @efesto-cloud/mongodb-population @efesto-cloud/population mongodb
```

## How it fits together

For each entity you want to populate, you write three small files:

1. **Shape** — which fields are populatable, and whether they're leaves or nested.
2. **Populator** — extends `BasePopulator`, turns a spec into `$lookup` stages.
3. **QueryBuilder** — extends `QueryBuilder`, exposes `populateWith(spec)` for repositories.

Then the repository composes a pipeline with the builder and runs `aggregate()`.

## `BasePopulator`

```ts
abstract class BasePopulator<TShape, TCollection extends string> {
    protected lookup(options: {
        from: TCollection;
        localField: string;
        foreignField: string;
        as: string;
        pipeline?: Document[];
    }): Document;

    protected unwind(path: string): Document;
    protected addStages(...stages: Document[]): void;

    protected markPopulated(field: string): boolean; // false if already populated
    protected isPopulated(field: string): boolean;

    abstract populate(spec: NormalizedPopulate<TShape>): this;

    build(): Document[];
}
```

### Example: flat populator

```ts
import { BasePopulator } from "@efesto-cloud/mongodb-population";
import type { NormalizedPopulate } from "@efesto-cloud/population";

type PostShape = {
    author: true;    // 1:1, leaf
    comments: true;  // 1:many, leaf
};

export default class PostPopulator extends BasePopulator<PostShape> {
    static readonly SHAPE: PostShape = { author: true, comments: true };

    private author() {
        if (!this.markPopulated("author")) return;
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
        if (!this.markPopulated("comments")) return;
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

    populate(spec: NormalizedPopulate<PostShape>): this {
        if (spec.author) this.author();
        if (spec.comments) this.comments();
        return this;
    }

    static buildPipeline(spec: NormalizedPopulate<PostShape>): Document[] {
        return new PostPopulator().populate(spec).build();
    }
}
```

### Nested population

When a related entity itself has a populator, pass its pipeline as a sub-pipeline:

```ts
private author(nestedSpec: NormalizedPopulate<AuthorShape>) {
    if (!this.markPopulated("author")) return;
    this.addStages(
        this.lookup({
            from: "authors",
            localField: "author_id",
            foreignField: "_id",
            as: "author",
            pipeline: AuthorPopulator.buildPipeline(nestedSpec),
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

    // protected — use from subclass to expose a typed populateWith()
    protected populate(lookup, { unwind }): this;
    protected push_populate_pipeline(pipeline: Document[]): this;
}
```

Stage order in `build()`: `$match` → `$set` → `$sort` → `$skip` → `$limit` → populate pipeline. Filters and pagination run before the joins so `$lookup` only runs against the final result set.

### Example: typed populate-aware builder

```ts
import QueryBuilder from "@efesto-cloud/mongodb-population/QueryBuilder";
import { normalizePopulate, type Populate } from "@efesto-cloud/population";
import PostPopulator from "./PostPopulator.js";
import type { PostShape } from "./PostShape.js";

export default class PostQueryBuilder extends QueryBuilder<PostDocument> {
    populateWith(fields: Populate<PostShape> = {}): this {
        const normalized = normalizePopulate(fields, PostPopulator.SHAPE);
        const pipeline = PostPopulator.buildPipeline(normalized);
        this.push_populate_pipeline(pipeline);
        return this;
    }
}
```

### Using it in a repository

```ts
async get(id: ObjectId, options?: { populate?: Populate<PostShape> }) {
    const pipeline = new PostQueryBuilder()
        .match({ _id: id })
        .populateWith(options?.populate)
        .limit(1)
        .build();

    const docs = await this.coll
        .aggregate<PostDocument>(pipeline, { session: this.db.session })
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

- [`@efesto-cloud/population`](../population) — spec types and `normalizePopulate`.
- `.claude/skills/population` — end-to-end recipe covering entity/DTO/document/mapper/repository patches.
