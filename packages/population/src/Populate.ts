/**
 * KISS Recursive Populate Type
 *
 * Handles all populate formats:
 * - true: populate with defaults
 * - '*': populate all fields
 * - 'field': single field name
 * - ['field1', 'field2']: array of field names
 * - { field: true, relation: { ... } }: object with nested specs
 * - ['field', { relation: { ... } }]: mixed array
 */
export type Populate<T> =
    | true
    | "*"
    | keyof T // Single field: 'name'
    | (keyof T)[] // Array of fields: ['name', 'code']
    | { [K in keyof T]?: Populate<T[K]> } // Object form: { name: true, relation: {...} }
    | (keyof T | { [K in keyof T]?: Populate<T[K]> })[]; // Mixed array: ['name', { relation: {...} }]
