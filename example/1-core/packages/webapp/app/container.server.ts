import {
    Auth,
    AuthModule,
    type Database,
    ExpensesModule,
    type IAuthorizer,
    type IIdentifier,
    implModule,
    type ResolveUseCase,
} from "@expenses/core";
import { Container } from "inversify";

/** The composition root: the only place that knows which implementations run. */
export async function createContainer(config: {
    db: Database;
    mailUrl: string;
}) {
    const container = new Container();
    await container.load(implModule(config), AuthModule, ExpensesModule);
    const resolveUseCase: ResolveUseCase = (key) => container.get(key);
    return {
        resolveUseCase,
        identifier: container.get<IIdentifier>(Auth.Identifier),
        authorizer: container.get<IAuthorizer>(Auth.Authorizer),
    };
}
