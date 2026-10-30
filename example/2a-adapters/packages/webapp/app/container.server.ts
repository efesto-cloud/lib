import {
    Auth,
    AuthModule,
    ExpensesModule,
    type IAuthorizer,
    type IIdentifier,
    type ResolveUseCase,
} from "@expenses/core";
import { type Database, installDb } from "@expenses/db-adapter";
import { installFile } from "@expenses/file-adapter";
import { installMail } from "@expenses/mail-adapter";
import { installStub, type StubStore } from "@expenses/stub-adapter";
import { Container } from "inversify";

export type AppConfig =
    | { mock: true; store?: StubStore }
    | { mock: false; db: Database; mailUrl: string };

/** The composition root: the only place that chooses real adapters or the stub. */
export async function createContainer(config: AppConfig) {
    const container = new Container();
    await container.load(
        ...(config.mock
            ? [installStub(config.store)]
            : [
                  installDb({ db: config.db }),
                  installMail({ url: config.mailUrl }),
                  installFile(),
              ]),
        AuthModule,
        ExpensesModule,
    );
    const resolveUseCase: ResolveUseCase = (key) => container.get(key);
    return {
        resolveUseCase,
        identifier: container.get<IIdentifier>(Auth.Identifier),
        authorizer: container.get<IAuthorizer>(Auth.Authorizer),
    };
}
