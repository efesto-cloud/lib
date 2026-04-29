/**
 * Prisma Populator examples for the prisma-population skill.
 *
 * A Populator subclasses BasePrismaPopulator<TShape> and declares which fields
 * the entity can eager-load. The base class converts a Populate<TShape> spec into
 * a Prisma `include` object via toPrismaInclude().
 *
 * Usage in a repository:
 *   const include = new FooPopulator().build(options?.populate);
 *   await this.db.client.foo.findMany({ where, ...(include ? { include } : {}) });
 */

import BasePrismaPopulator from "@efesto-cloud/prisma-population";

// ---------------------------------------------------------------------------
// 1. Flat Populator — no nested population
// ---------------------------------------------------------------------------

/**
 * FooShape: declares populatable fields for Foo.
 * - `category` is a 1:1 relation (FK on Foo)
 * - `tags` is a 1:many relation (Prisma handles both via `include`)
 */
export type FooShape = {
    category: true;
    tags: true;
};

/**
 * FooPopulator: minimal subclass — just implement shape().
 *
 * BasePrismaPopulator.build(spec) normalizes the Populate<FooShape> input,
 * iterates the result, and adds each requested key to the Prisma include object.
 * The result is a PrismaInclude like:
 *   { category: true }           — when only category was requested
 *   { category: true, tags: true } — when both were requested
 *   undefined                    — when spec is undefined or empty
 */
export class FooPopulator extends BasePrismaPopulator<FooShape> {
    protected shape(): FooShape {
        return {
            category: true,
            tags: true,
        };
    }
}

// Repository usage:
//   const include = new FooPopulator().build(options?.populate);
//   // include is: { category: true, tags: true } | { category: true } | undefined | etc.
//   await this.db.client.foo.findMany({
//     where: { ... },
//     ...(include ? { include } : {}),
//   });


// ---------------------------------------------------------------------------
// 2. Nested Populator — a field references another entity's Shape
// ---------------------------------------------------------------------------

import type { BarShape } from "../shape/BarShape.js"; // hypothetical

/**
 * CompositeShape: demonstrates mixed leaf + nested fields.
 * - `owner` is a leaf (Owner has no populator of its own)
 * - `bar` is nested (Bar itself has populatable fields described by BarShape)
 */
export type CompositeShape = {
    owner: true;
    bar: BarShape;
};

/**
 * CompositePopulator: nested population.
 *
 * When a Shape field is typed as another Shape (here `bar: BarShape`),
 * BasePrismaPopulator calls toPrismaInclude() recursively, producing:
 *   { bar: { include: { barField: true, ... } } }
 *
 * No extra code is needed in the subclass beyond declaring the Shape type correctly.
 */
export class CompositePopulator extends BasePrismaPopulator<CompositeShape> {
    protected shape(): CompositeShape {
        return {
            owner: true,
            bar: {
                // The BarShape static value — must match what BarPopulator would declare.
                // Inline it here or import BarPopulator.SHAPE if Bar also has a Populator.
                relatedThing: true,
            } as BarShape,
        };
    }
}

// Caller can request nested population:
//   options.populate = { bar: { relatedThing: true } }
// This produces:
//   { bar: { include: { relatedThing: true } } }
// Which Prisma uses as: prisma.composite.findMany({ include: { bar: { include: { relatedThing: true } } } })


// ---------------------------------------------------------------------------
// 3. How PrismaInclude / toPrismaInclude works (for reference)
// ---------------------------------------------------------------------------
//
// PrismaInclude = { [key: string]: true | { include: PrismaInclude } }
//
// Examples:
//   { category: true }
//   → prisma.foo.findMany({ include: { category: true } })
//   → fetches the category relation as a flat object
//
//   { bar: { include: { relatedThing: true } } }
//   → prisma.foo.findMany({ include: { bar: { include: { relatedThing: true } } } })
//   → fetches bar, and within bar also fetches relatedThing
//
// build() returns undefined when no fields are requested, so always spread conditionally:
//   ...(include ? { include } : {})
