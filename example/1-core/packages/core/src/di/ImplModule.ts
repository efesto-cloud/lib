import { ContainerModule } from "inversify";
import Database from "../repo/impl/Database.js";
import ExpenseRepository from "../repo/impl/ExpenseRepository.js";
import ExpenseStatusChangeRepository from "../repo/impl/ExpenseStatusChangeRepository.js";
import MemberRepository from "../repo/impl/MemberRepository.js";
import SqliteUnitOfWork from "../repo/impl/SqliteUnitOfWork.js";
import CsvExpenseFileReader from "../service/impl/CsvExpenseFileReader.js";
import HttpMailer from "../service/impl/HttpMailer.js";
import { Port } from "./Port.js";

/** Rung 1: the implementations of the ports still live in the core. */
export function implModule(config: { db: Database; mailUrl: string }) {
    return new ContainerModule(({ bind }) => {
        bind(Port.Database).toConstantValue(config.db);
        bind(Port.UnitOfWork).to(SqliteUnitOfWork).inRequestScope();
        bind(Port.ExpenseRepository).to(ExpenseRepository);
        bind(Port.ExpenseStatusChangeRepository).to(
            ExpenseStatusChangeRepository,
        );
        bind(Port.MemberRepository).to(MemberRepository);
        bind(Port.Mailer).toConstantValue(new HttpMailer(config.mailUrl));
        bind(Port.ExpenseFileReader).toConstantValue(
            new CsvExpenseFileReader(),
        );
    });
}

export { Database };
