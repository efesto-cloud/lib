/**
 * Normalize any populate format into the standardized object format.
 *
 * Handles:
 * - undefined → {} (empty)
 * - true → all fields expanded
 * - '*' → all fields expanded
 * - 'field' → { field: true }
 * - ['field1', 'field2'] → { field1: true, field2: true }
 * - { field: value } → recurse on nested shapes
 * - Mixed array → merge all specs
 */

import type { NormalizedPopulate } from "./NormalizedPopulate.js";
import type { Populate } from "./Populate.js";

/**
 * Type guard to check if a shape value is a nested shape (object, not true)
 */
function isNestedShape(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Normalize a single populate spec or array of specs into the object format.
 *
 * @param spec - The populate specification(s) to normalize
 * @param shape - The shape definition (used to expand '*' and true)
 * @returns The normalized object representation
 */
export function normalizePopulate<T extends Record<string, unknown>>(
    spec: Populate<T> | Populate<T>[] | undefined,
    shape: T,
): NormalizedPopulate<T> {
    if (spec === undefined) {
        return {} as NormalizedPopulate<T>;
    }

    // Handle true - expand all fields
    if (spec === true) {
        return expandAllFields(shape);
    }

    // Handle '*' - expand all fields
    if (spec === "*") {
        return expandAllFields(shape);
    }

    // Handle single string field
    if (typeof spec === "string") {
        return { [spec]: true } as NormalizedPopulate<T>;
    }

    // Handle array (could be string array or mixed array)
    if (Array.isArray(spec)) {
        return mergeSpecs(spec, shape);
    }

    // Handle object spec
    if (typeof spec === "object" && spec !== null) {
        return normalizeObjectSpec(spec as Record<string, unknown>, shape);
    }

    return {} as NormalizedPopulate<T>;
}

/**
 * Expand all fields from the shape into { field: true, ... }
 */
function expandAllFields<T extends Record<string, unknown>>(
    shape: T,
): NormalizedPopulate<T> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(shape)) {
        const value = shape[key];
        if (value === true) {
            result[key] = true;
        } else if (typeof value === "object" && value !== null) {
            // For nested shapes, just mark as true (shallow expansion)
            result[key] = true;
        }
    }

    return result as NormalizedPopulate<T>;
}

/**
 * Merge an array of specs into a single normalized object
 */
function mergeSpecs<T extends Record<string, unknown>>(
    specs: unknown[],
    shape: T,
): NormalizedPopulate<T> {
    const result: Record<string, unknown> = {};

    for (const spec of specs) {
        // Handle string field
        if (typeof spec === "string") {
            result[spec] = true;
        }
        // Handle nested object spec
        else if (typeof spec === "object" && spec !== null) {
            const normalized = normalizeObjectSpec(
                spec as Record<string, unknown>,
                shape,
            );
            mergeInto(result, normalized);
        }
    }

    return result as NormalizedPopulate<T>;
}

/**
 * Normalize an object spec, recursing into nested shapes
 */
function normalizeObjectSpec<T extends Record<string, unknown>>(
    spec: Record<string, unknown>,
    shape: T,
): NormalizedPopulate<T> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(spec)) {
        const shapeValue = shape[key];

        if (value === true) {
            result[key] = true;
        } else if (value === "*") {
            // Expand '*' for nested shapes
            if (isNestedShape(shapeValue)) {
                result[key] = expandAllFields(shapeValue);
            } else {
                result[key] = true;
            }
        } else if (Array.isArray(value)) {
            // Nested array - recurse with the nested shape
            if (isNestedShape(shapeValue)) {
                result[key] = mergeSpecs(value, shapeValue);
            } else {
                result[key] = true;
            }
        } else if (typeof value === "object" && value !== null) {
            // Nested object - recurse
            if (isNestedShape(shapeValue)) {
                result[key] = normalizeObjectSpec(
                    value as Record<string, unknown>,
                    shapeValue,
                );
            } else {
                result[key] = true;
            }
        }
    }

    return result as NormalizedPopulate<T>;
}

/**
 * Merge source into target, deeply merging nested objects
 */
function mergeInto(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
): void {
    for (const [key, value] of Object.entries(source)) {
        const existing = target[key];

        if (existing === undefined) {
            target[key] = value;
        } else if (isNestedShape(existing) && isNestedShape(value)) {
            // Deep merge nested objects
            mergeInto(existing, value);
        }
        // If existing is true, keep it (most expansive)
        // If value is true but existing is object, keep object (more specific)
    }
}
