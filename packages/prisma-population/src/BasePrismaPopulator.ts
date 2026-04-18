import {
    normalizePopulate,
    type NormalizedPopulate,
    type Populate,
} from "@efesto-cloud/population";
import { toPrismaInclude, type PrismaInclude } from "./toPrismaInclude.js";

export default abstract class BasePrismaPopulator<
    TShape extends Record<string, unknown>,
> {
    protected include: PrismaInclude = {};

    protected abstract shape(): TShape;

    protected field(
        key: keyof TShape,
        value: true | NormalizedPopulate<unknown>,
    ): void {
        if (value === true) {
            this.include[key as string] = true;
            return;
        }
        const nested = toPrismaInclude(value);
        this.include[key as string] = nested ? { include: nested } : true;
    }

    build(spec: Populate<TShape> | undefined): PrismaInclude | undefined {
        const normalized = normalizePopulate(spec, this.shape());
        for (const [k, v] of Object.entries(normalized)) {
            if (v === undefined || v === false) continue;
            this.field(k as keyof TShape, v as true | NormalizedPopulate<unknown>);
        }
        return Object.keys(this.include).length ? this.include : undefined;
    }
}
