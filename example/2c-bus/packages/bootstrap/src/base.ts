import {
    Auth,
    AuthModule,
    ExpensesModule,
    type IAuthorizer,
    type IIdentifier,
    type IJobSource,
    Port,
    type ResolveUseCase,
} from "@expenses/core";
import { Database, installDb } from "@expenses/db-adapter";
import { installMail } from "@expenses/mail-adapter";
import { installQueue } from "@expenses/queue-adapter";
import { installStub, type StubStore } from "@expenses/stub-adapter";
import { Container, type ContainerModule } from "inversify";

/** What a process passes in. It comes from the caller, never from process.env. */
export type Env = {
    MOCK?: string;
    DB_PATH?: string;
    MAIL_URL?: string;
    QUEUE_PATH?: string;
};

export type BootOptions = {
    /** Mock mode only: the in-memory store, to share it between processes in tests. */
    store?: StubStore;
};

export class MissingEnv extends Error {
    readonly _tag = "MissingEnv";
    constructor(readonly keys: string[]) {
        super(`Missing environment: ${keys.join(", ")}`);
    }
}

/** A use case whose ports this profile does not bind. */
export class UseCaseUnavailable extends Error {
    readonly _tag = "UseCaseUnavailable";
    constructor(
        readonly key: string,
        options: ErrorOptions,
    ) {
        super(`Use case ${key} is not available in this profile`, options);
    }
}

export async function boot(
    env: Env,
    profile: {
        requires: (keyof Env)[];
        adapters: (env: Env) => ContainerModule[];
    },
    options: BootOptions = {},
) {
    const mock = env.MOCK === "1";
    if (!mock) {
        const missing = profile.requires.filter((key) => !env[key]);
        if (missing.length > 0) throw new MissingEnv(missing);
    }

    const container = new Container();
    await container.load(
        ...(mock
            ? [installStub(options.store)]
            : [
                  installDb({ db: new Database(env.DB_PATH) }),
                  installMail({ url: env.MAIL_URL as string }),
                  installQueue({ path: env.QUEUE_PATH as string }),
                  ...profile.adapters(env),
              ]),
        AuthModule,
        ExpensesModule,
    );

    const resolveUseCase: ResolveUseCase = (key) => {
        try {
            return container.get(key);
        } catch (cause) {
            throw new UseCaseUnavailable(key, { cause });
        }
    };
    return {
        resolveUseCase,
        identifier: container.get<IIdentifier>(Auth.Identifier),
        authorizer: container.get<IAuthorizer>(Auth.Authorizer),
        jobs: container.get<IJobSource>(Port.JobSource),
    };
}

export type Booted = Awaited<ReturnType<typeof boot>>;
