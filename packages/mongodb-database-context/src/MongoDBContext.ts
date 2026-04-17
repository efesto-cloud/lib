import type { ClientSession, MongoClient } from "mongodb";
import type IMongoDBContext from "./IMongoDBContext.js";

export default class MongoDBContext implements IMongoDBContext {
    private _session: ClientSession | undefined;

    constructor(private readonly client: MongoClient) {}

    get session() {
        return this._session;
    }

    get sessionOrNull() {
        return this._session ?? null;
    }

    private async startSession() {
        if (this._session === undefined)
            this._session = this.client.startSession();
        return this._session;
    }

    private async terminateSession() {
        if (this._session !== undefined) {
            await this._session.endSession();
            this._session = undefined;
        }
    }

    async runWithTransaction<T>(fn: () => Promise<T>) {
        const session = await this.startSession();
        if (!session.inTransaction()) {
            try {
                return await session.withTransaction<T>(fn);
            } finally {
                await this.terminateSession();
            }
        } else {
            const result = await fn();
            return result;
        }
    }
}
