import {
    type Expand,
    type NormalizedExpand,
    normalizeExpand,
} from "@efesto-cloud/expand";
import { type PrismaInclude, toPrismaInclude } from "./toPrismaInclude.js";

export default abstract class BasePrismaExpander<
    TShape extends Record<string, unknown>,
> {
    protected include: PrismaInclude = {};

    protected abstract shape(): TShape;

    protected field(
        key: keyof TShape,
        value: true | NormalizedExpand<unknown>,
    ): void {
        if (value === true) {
            this.include[key as string] = true;
            return;
        }
        const nested = toPrismaInclude(value);
        this.include[key as string] = nested ? { include: nested } : true;
    }

    build(spec: Expand<TShape> | undefined): PrismaInclude | undefined {
        const normalized = normalizeExpand(spec, this.shape());
        for (const [k, v] of Object.entries(normalized)) {
            if (v === undefined || v === false) continue;
            this.field(
                k as keyof TShape,
                v as true | NormalizedExpand<unknown>,
            );
        }
        return Object.keys(this.include).length ? this.include : undefined;
    }
}
