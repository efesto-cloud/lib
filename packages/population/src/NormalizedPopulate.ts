/**
 * Normalized populate format - the standardized object representation
 *
 * All populate inputs (string, array, mixed array, etc.) are normalized
 * to this format before being processed by populators.
 *
 * Example:
 *   Input: ['raster', { variante: ['caratteristica'] }]
 *   Output: { raster: true, variante: { caratteristica: true } }
 */
export type NormalizedPopulate<SHAPE> = {
    [K in keyof SHAPE]?: SHAPE[K] extends true
        ? true
        : NormalizedPopulate<SHAPE[K]>;
};
