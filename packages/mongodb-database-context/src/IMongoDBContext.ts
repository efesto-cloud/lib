import type { IDatabaseContext } from "@efesto-cloud/database-context";
import type { ClientSession } from "mongodb";

export default interface IMongoDBContext extends IDatabaseContext {
    readonly session: ClientSession | undefined;
    readonly sessionOrNull: ClientSession | null;
}
