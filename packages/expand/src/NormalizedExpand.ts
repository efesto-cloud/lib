/**
 * Normalized expand format - the standardized object representation
 *
 * All expand inputs (string, array, mixed array, etc.) are normalized
 * to this format before being processed by expanders.
 *
 * Example:
 *   Input: ['raster', { variante: ['caratteristica'] }]
 *   Output: { raster: true, variante: { caratteristica: true } }
 */
export type NormalizedExpand<SHAPE> = {
    [K in keyof SHAPE]?: SHAPE[K] extends true
        ? true
        : NormalizedExpand<SHAPE[K]>;
};
