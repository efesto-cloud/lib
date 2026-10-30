import { Port } from "@expenses/core";
import { ContainerModule } from "inversify";
import SqliteJobQueue from "./SqliteJobQueue.js";

export function installQueue(config: { path: string }) {
    const queue = new SqliteJobQueue(config.path);
    return new ContainerModule(({ bind }) => {
        bind(Port.JobQueue).toConstantValue(queue);
        bind(Port.JobSource).toConstantValue(queue);
    });
}
