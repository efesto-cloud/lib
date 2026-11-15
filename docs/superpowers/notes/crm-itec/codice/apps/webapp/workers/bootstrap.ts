import type { UseCaseResolver } from "@itec/contract/registry";
import InternalSymbols from "@itec/core/di/InternalSymbols";
import { install } from "@itec/core/di/install";
import { installConfig } from "@itec/core/di/installConfig";
import { createUseCaseResolver } from "@itec/core/di/resolveUseCase";
import type IPasswordHasher from "@itec/core/service/IPasswordHasher";
import Pbkdf2PasswordHasher from "@itec/core/service/impl/Pbkdf2PasswordHasher";
import { installD1 } from "@itec/d1-adapter/installD1";
import { Container } from "inversify";

// Un container per tutto il Worker: ogni `resolveUseCase(key)` è una
// risoluzione nuova, quindi una Unit of Work nuova.
let resolveUseCase: UseCaseResolver | undefined;

export function getResolveUseCase(env: Env): UseCaseResolver {
    if (!resolveUseCase) {
        const container = new Container({ defaultScope: "Singleton" });
        install(container);
        container.load(installConfig(env), installD1({ DB: env.DB }));
        container
            .bind<IPasswordHasher>(InternalSymbols.Service.PasswordHasher)
            .to(Pbkdf2PasswordHasher);
        resolveUseCase = createUseCaseResolver(container);
    }
    return resolveUseCase;
}
