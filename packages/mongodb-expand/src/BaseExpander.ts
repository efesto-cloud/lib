import type { NormalizedExpand } from "@efesto-cloud/expand/index";
import type { Document } from "mongodb";

export interface LookupOptions<TCollection extends string = string> {
    from: TCollection;
    localField: string;
    foreignField: string;
    as: string;
    pipeline?: Document[];
}

export default abstract class BaseExpander<
    TShape,
    TCollection extends string = string,
> {
    protected pipeline: Document[] = [];
    protected expandedFields: Set<string> = new Set();

    /**
     * Create a $lookup aggregation stage
     */
    protected lookup(options: LookupOptions<TCollection>): Document {
        return {
            $lookup: {
                from: options.from,
                localField: options.localField,
                foreignField: options.foreignField,
                as: options.as,
                pipeline: options.pipeline ?? [],
            },
        };
    }

    /**
     * Create an $unwind stage with preserveNullAndEmptyArrays: true
     */
    protected unwind(path: string): Document {
        return {
            $unwind: {
                path: `$${path}`,
                preserveNullAndEmptyArrays: true,
            },
        };
    }

    /**
     * Add multiple stages to the pipeline
     */
    protected addStages(...stages: Document[]): void {
        this.pipeline.push(...stages);
    }

    /**
     * Mark a field as expanded. Returns false if already expanded.
     */
    protected markExpanded(field: string): boolean {
        if (this.expandedFields.has(field)) {
            return false;
        }
        this.expandedFields.add(field);
        return true;
    }

    /**
     * Check if a field has been expanded
     */
    protected isExpanded(field: string): boolean {
        return this.expandedFields.has(field);
    }

    /**
     * Expand the entity based on the normalized spec
     */
    abstract expand(spec: NormalizedExpand<TShape>): this;

    /**
     * Build and return the aggregation pipeline
     */
    build(): Document[] {
        return this.pipeline;
    }
}
