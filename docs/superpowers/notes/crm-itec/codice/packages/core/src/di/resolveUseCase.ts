import type {
    Guarded,
    UseCaseRegistry,
    UseCaseResolver,
} from "@itec/contract/registry";
import type { Container } from "inversify";
import { guardedId } from "~/di/useCaseModule.js";

export function createUseCaseResolver(container: Container): UseCaseResolver {
    return <K extends keyof UseCaseRegistry>(key: K) =>
        container.get<Guarded<UseCaseRegistry[K]>>(guardedId(key));
}
