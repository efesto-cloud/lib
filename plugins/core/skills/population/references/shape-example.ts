/**
 * Shape type examples for the population (expand) skill.
 *
 * A Shape is a pure TypeScript type that declares which fields of an entity
 * can be populated (eager-loaded — e.g. via MongoDB $lookup). The repository
 * exposes an `Expand<FooShape>` option that callers use to request specific fields.
 *
 */

// ---------------------------------------------------------------------------
// 1. Leaf Shape — every field is `true` (no further nesting)
// ---------------------------------------------------------------------------

/**
 * FooShape: Foo can eager-load two related entities.
 * - `category` is a single related document (1:1 via category_id FK)
 * - `tags` is an array of related documents (1:many via tag.foo_id FK)
 *
 * Using `true` means: the related entity has no expander of its own,
 * or we don't need to go deeper than one level.
 */
export type FooShape = {
    category: true;
    tags: true;
};


// ---------------------------------------------------------------------------
// 2. Nested Shape — a field references another entity's Shape type
// ---------------------------------------------------------------------------

import type { BarShape } from './BarShape.js';  // hypothetical
import type { BazShape } from './BazShape.js';  // hypothetical

/**
 * CompositeShape: demonstrates mixed leaf + nested fields.
 *
 * - `owner` is a leaf (the Owner entity has no expander, or we never go deeper)
 * - `bar` is nested: Bar itself has expandable fields (BarShape), so callers
 *   can request `{ bar: { relatedThing: true } }` to go two levels deep.
 * - `bazList` is a nested 1:many array where each Baz item is also expandable.
 */
export type CompositeShape = {
    owner: true;       // leaf — Owner has no further expansion
    bar: BarShape;     // nested — Bar can be further expanded
    bazList: BazShape; // nested array — each Baz can be further expanded
};


// ---------------------------------------------------------------------------
// 3. Rules of thumb
// ---------------------------------------------------------------------------
//
// Use `true` when:
//   - The related entity has no Expander of its own, OR
//   - You never need to go deeper than one $lookup from this entity.
//
// Use `RelatedShape` when:
//   - The related entity already has (or will have) its own Expander, AND
//   - Callers might want to expand fields of the related entity too.
//
// Shape types never contain runtime logic — they are type-level descriptions
// consumed by `normalizeExpand()` from @efesto-cloud/expand.
