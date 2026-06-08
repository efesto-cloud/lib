/**
 * QueryBuilder example for the population skill.
 *
 * Each entity that supports population gets its own QueryBuilder subclass.
 * The subclass's only job is to wire the entity's Shape + Expander into the
 * base QueryBuilder via a single `expandWith()` method.
 *
 * Replace `~/` path alias with whatever alias your tsconfig defines.
 */

import { normalizeExpand, type Expand } from '@efesto-cloud/expand';
import { QueryBuilder } from '@efesto-cloud/mongodb-expand';
import type FooDocument from '~/db/Documents/FooDocument.js';
import FooExpander from '../expand/FooExpander.js';
import type { FooShape } from '../shape/FooShape.js';

/**
 * FooQueryBuilder — builds MongoDB aggregation pipelines for the Foo collection.
 *
 * Usage:
 *   const pipeline = new FooQueryBuilder()
 *     .match({ deleted_at: null })
 *     .sort({ name: 1 })
 *     .page(pageNumber, pageSize)
 *     .expandWith({ category: true })          // only load category
 *     .expandWith('*')                         // load all fields
 *     .expandWith(['category', 'tags'])        // load by array
 *     .build();
 *
 * NOTE: expandWith() must come AFTER match/sort/page in the chain because
 * the base QueryBuilder appends $lookup stages at the end of the pipeline,
 * after $match/$sort/$skip/$limit — which is the correct MongoDB order for
 * performance (filter and paginate before joining).
 */
export default class FooQueryBuilder extends QueryBuilder<FooDocument> {
    /**
     * @param fields - Expand spec: object, array, `'*'`, or undefined/empty.
     *   Passing nothing or `{}` produces no $lookup stages.
     *   The `Expand<FooShape>` type from @efesto-cloud/expand accepts multiple formats:
     *     { category: true }
     *     ['category', 'tags']
     *     '*'
     *     { bar: { nestedField: true } }  // nested shape
     */
    expandWith(fields: Expand<FooShape> = {}): this {
        // normalizeExpand converts any input format into a uniform object
        // and validates against the shape definition (unknown keys become false).
        const normalized = normalizeExpand(fields, FooExpander.SHAPE);
        const pipeline = FooExpander.buildPipeline(normalized);
        this.push_expand_pipeline(pipeline);
        return this;
    }
}
