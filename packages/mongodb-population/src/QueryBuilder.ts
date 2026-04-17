import type { Document, Filter } from "mongodb";

export default class QueryBuilder<
    D extends Document,
    C extends string = string,
> {
    private _match: Filter<D> = {};
    private _populate_pipeline: Document[] = [];
    private _set: Document = {};
    private _sort: { [key in keyof D]?: 1 | -1 } | null = null;
    private _skip: number | null = null;
    private _limit: number | null = null;

    match(filter: Filter<D>): this {
        if (Object.keys(filter).length > 0) {
            this._match = { ...this._match, ...filter };
        }
        return this;
    }

    protected populate(
        lookup: {
            from: C;
            localField: string;
            foreignField: string;
            as: string;
            pipeline?: Document[];
        },
        options: { unwind: boolean },
    ): this {
        const pipeline: Document[] = [
            {
                $lookup: {
                    from: lookup.from,
                    localField: lookup.localField,
                    foreignField: lookup.foreignField,
                    as: lookup.as,
                    pipeline: lookup.pipeline ?? [],
                },
            },
        ];
        if (options.unwind) {
            pipeline.push({
                $unwind: {
                    path: `$${lookup.as}`,
                    preserveNullAndEmptyArrays: true,
                },
            });
        }
        this._populate_pipeline.push(...pipeline);
        return this;
    }

    protected push_populate_pipeline(pipeline: Document[]): this {
        this._populate_pipeline.push(...pipeline);
        return this;
    }

    set(set: Document): this {
        this._set = set;
        return this;
    }

    sort(sort: { [key in keyof D]?: 1 | -1 }): this {
        this._sort = sort;
        return this;
    }

    skip(count: number): this {
        this._skip = count;
        return this;
    }

    limit(count: number): this {
        this._limit = count;
        return this;
    }

    page(page: number = 1, page_size: number = 25): this {
        this.skip((page - 1) * page_size);
        this.limit(page_size);
        return this;
    }

    build(): Document[] {
        const pipeline: Document[] = [];

        // 1. Filter first - reduce dataset early
        if (Object.keys(this._match).length > 0) {
            pipeline.push({ $match: this._match });
        }

        // 5. Project fields before joins (optional optimization)
        if (Object.keys(this._set).length > 0) {
            pipeline.push({ $set: this._set });
        }

        // 2. Sort before pagination
        if (this._sort) {
            pipeline.push({ $sort: this._sort });
        }

        // 3. Skip records (pagination)
        if (this._skip !== null) {
            pipeline.push({ $skip: this._skip });
        }

        // 4. Limit results (pagination)
        if (this._limit !== null) {
            pipeline.push({ $limit: this._limit });
        }

        // 6. Populate last - only join the final result set
        if (this._populate_pipeline.length > 0) {
            pipeline.push(...this._populate_pipeline);
        }

        return pipeline;
    }
}
