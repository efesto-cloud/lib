import type IPrismaContext from "./IPrismaContext.js";
import type { PrismaLikeClient, PrismaTxOf } from "./IPrismaContext.js";

export default class PrismaContext<
    TClient extends PrismaLikeClient<PrismaTxOf<TClient>> = PrismaLikeClient,
> implements IPrismaContext<TClient>
{
    private _tx: PrismaTxOf<TClient> | undefined;

    constructor(private readonly root: TClient) {}

    get client(): TClient | PrismaTxOf<TClient> {
        return this._tx ?? this.root;
    }

    async runWithTransaction<T>(fn: () => Promise<T>): Promise<T> {
        if (this._tx !== undefined) {
            return await fn();
        }
        return await this.root.$transaction(async (tx) => {
            this._tx = tx;
            try {
                return await fn();
            } finally {
                this._tx = undefined;
            }
        });
    }
}
