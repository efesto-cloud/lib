import type { NormalizedPopulate } from "@efesto-cloud/population";

export type PrismaInclude = {
    [key: string]: true | { include: PrismaInclude };
};

export function toPrismaInclude<S>(
    spec: NormalizedPopulate<S> | undefined,
): PrismaInclude | undefined {
    if (!spec) return undefined;
    const entries = Object.entries(spec).filter(
        ([, v]) => v !== undefined && v !== false,
    );
    if (entries.length === 0) return undefined;
    const out: PrismaInclude = {};
    for (const [k, v] of entries) {
        if (v === true) {
            out[k] = true;
        } else {
            const nested = toPrismaInclude(v as NormalizedPopulate<unknown>);
            out[k] = nested ? { include: nested } : true;
        }
    }
    return out;
}
