/**
 * Prisma Expander examples for the prisma-population skill.
 *
 * An Expander subclasses BasePrismaExpander<TShape> and declares which fields
 * the entity can eager-load. The base class converts an Expand<TShape> spec into
 * a Prisma `include` object via toPrismaInclude().
 *
 * Usage in a repository:
 *   const include = new FooExpander().build(options?.expand);
 *   await this.db.client.foo.findMany({ where, ...(include ? { include } : {}) });
 */

import BasePrismaExpander from "@efesto-cloud/prisma-expand";

// ---------------------------------------------------------------------------
// 1. Flat Expander — no nested population
// ---------------------------------------------------------------------------

/**
 * FooShape: declares expandable fields for Foo.
 * - `category` is a 1:1 relation (FK on Foo)
 * - `tags` is a 1:many relation (Prisma handles both via `include`)
 */
export type FooShape = {
    category: true;
    tags: true;
};

/**
 * FooExpander: minimal subclass — just implement shape().
 *
 * BasePrismaExpander.build(spec) normalizes the Expand<FooShape> input,
 * iterates the result, and adds each requested key to the Prisma include object.
 * The result is a PrismaInclude like:
 *   { category: true }           — when only category was requested
 *   { category: true, tags: true } — when both were requested
 *   undefined                    — when spec is undefined or empty
 */
export class FooExpander extends BasePrismaExpander<FooShape> {
    protected shape(): FooShape {
        return {
            category: true,
            tags: true,
        };
    }
}

// Repository usage:
//   const include = new FooExpander().build(options?.expand);
//   // include is: { category: true, tags: true } | { category: true } | undefined | etc.
//   await this.db.client.foo.findMany({
//     where: { ... },
//     ...(include ? { include } : {}),
//   });


// ---------------------------------------------------------------------------
// 2. Nested Expander — a field references another entity's Shape
// ---------------------------------------------------------------------------

import type { BarShape } from "../shape/BarShape.js"; // hypothetical

/**
 * CompositeShape: demonstrates mixed leaf + nested fields.
 * - `owner` is a leaf (Owner has no expander of its own)
 * - `bar` is nested (Bar itself has expandable fields described by BarShape)
 */
export type CompositeShape = {
    owner: true;
    bar: BarShape;
};

/**
 * CompositeExpander: nested population.
 *
 * When a Shape field is typed as another Shape (here `bar: BarShape`),
 * BasePrismaExpander calls toPrismaInclude() recursively, producing:
 *   { bar: { include: { barField: true, ... } } }
 *
 * No extra code is needed in the subclass beyond declaring the Shape type correctly.
 */
export class CompositeExpander extends BasePrismaExpander<CompositeShape> {
    protected shape(): CompositeShape {
        return {
            owner: true,
            bar: {
                // The BarShape static value — must match what BarExpander would declare.
                // Inline it here or import BarExpander.SHAPE if Bar also has an Expander.
                relatedThing: true,
            } as BarShape,
        };
    }
}

// Caller can request nested population:
//   options.expand = { bar: { relatedThing: true } }
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
