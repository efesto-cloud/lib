import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";
import type { ClientSession } from "mongodb";

export default interface IMongoDBUnitOfWork extends IUnitOfWork {
    readonly session: ClientSession | undefined;
    readonly sessionOrNull: ClientSession | null;
}
