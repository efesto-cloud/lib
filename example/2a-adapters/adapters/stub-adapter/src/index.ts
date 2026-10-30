import { Port } from "@expenses/core";
import { ContainerModule } from "inversify";
import InMemoryExpenseRepository from "./InMemoryExpenseRepository.js";
import InMemoryExpenseStatusChangeRepository from "./InMemoryExpenseStatusChangeRepository.js";
import InMemoryMemberRepository from "./InMemoryMemberRepository.js";
import InMemoryUnitOfWork from "./InMemoryUnitOfWork.js";
import StubExpenseFileReader from "./StubExpenseFileReader.js";
import StubMailer from "./StubMailer.js";
import StubStore from "./StubStore.js";
import { seed } from "./seed.js";

/** Binds every port in memory: mock mode and use case tests. */
export function installStub(store = seededStore()) {
    return new ContainerModule(({ bind }) => {
        bind(Port.UnitOfWork)
            .toDynamicValue(() => new InMemoryUnitOfWork(store))
            .inRequestScope();
        bind(Port.ExpenseRepository).toConstantValue(
            new InMemoryExpenseRepository(store),
        );
        bind(Port.ExpenseStatusChangeRepository).toConstantValue(
            new InMemoryExpenseStatusChangeRepository(store),
        );
        bind(Port.MemberRepository).toConstantValue(
            new InMemoryMemberRepository(store),
        );
        bind(Port.Mailer).toConstantValue(new StubMailer(store));
        bind(Port.ExpenseFileReader).toConstantValue(
            new StubExpenseFileReader(),
        );
    });
}

export function seededStore() {
    const store = new StubStore();
    seed(store);
    return store;
}

export {
    InMemoryExpenseRepository,
    InMemoryExpenseStatusChangeRepository,
    InMemoryMemberRepository,
    InMemoryUnitOfWork,
    StubExpenseFileReader,
    StubMailer,
    StubStore,
};
