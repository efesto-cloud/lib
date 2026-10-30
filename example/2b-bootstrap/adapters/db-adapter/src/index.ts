import { Port } from "@expenses/core";
import { ContainerModule } from "inversify";
import Database from "./Database.js";
import ExpenseRepository from "./ExpenseRepository.js";
import ExpenseStatusChangeRepository from "./ExpenseStatusChangeRepository.js";
import MemberRepository from "./MemberRepository.js";
import SqliteUnitOfWork from "./SqliteUnitOfWork.js";

export function installDb(config: { db: Database }) {
    return new ContainerModule(({ bind }) => {
        bind(Port.Database).toConstantValue(config.db);
        bind(Port.UnitOfWork).to(SqliteUnitOfWork).inRequestScope();
        bind(Port.ExpenseRepository).to(ExpenseRepository);
        bind(Port.ExpenseStatusChangeRepository).to(
            ExpenseStatusChangeRepository,
        );
        bind(Port.MemberRepository).to(MemberRepository);
    });
}

export { Database };
