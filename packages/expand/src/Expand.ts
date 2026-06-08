/**
 * KISS Recursive Expand Type
 *
 * Handles all expand formats:
 * - true: expand with defaults
 * - '*': expand all fields
 * - 'field': single field name
 * - ['field1', 'field2']: array of field names
 * - { field: true, relation: { ... } }: object with nested specs
 * - ['field', { relation: { ... } }]: mixed array
 */
export type Expand<T> =
    | true
    | "*"
    | keyof T // Single field: 'name'
    | (keyof T)[] // Array of fields: ['name', 'code']
    | { [K in keyof T]?: Expand<T[K]> } // Object form: { name: true, relation: {...} }
    | (keyof T | { [K in keyof T]?: Expand<T[K]> })[]; // Mixed array: ['name', { relation: {...} }]
