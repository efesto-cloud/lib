import type { NormalizedPopulate } from "@efesto-cloud/population/index";
import type { Document } from "mongodb";

export interface LookupOptions<TCollection extends string = string> {
    from: TCollection;
    localField: string;
    foreignField: string;
    as: string;
    pipeline?: Document[];
}

export default abstract class BasePopulator<
    TShape,
    TCollection extends string = string,
> {
    protected pipeline: Document[] = [];
    protected populatedFields: Set<string> = new Set();

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
     * Mark a field as populated. Returns false if already populated.
     */
    protected markPopulated(field: string): boolean {
        if (this.populatedFields.has(field)) {
            return false;
        }
        this.populatedFields.add(field);
        return true;
    }

    /**
     * Check if a field has been populated
     */
    protected isPopulated(field: string): boolean {
        return this.populatedFields.has(field);
    }

    /**
     * Populate the entity based on the normalized spec
     */
    abstract populate(spec: NormalizedPopulate<TShape>): this;

    /**
     * Build and return the aggregation pipeline
     */
    build(): Document[] {
        return this.pipeline;
    }
}
