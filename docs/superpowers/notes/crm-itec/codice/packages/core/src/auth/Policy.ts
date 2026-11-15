import type NotAllowedError from "@itec/contract/errors/NotAllowedError";
import type { ExecutionContext } from "@itec/contract/useCase";
import type { Result } from "better-result";
import { injectable } from "inversify";

/** Una policy pronta per uno use case che riceve `I`. */
export type PolicyClass<I> = new (...args: never[]) => Policy<I>;

/**
 * Chi può eseguire uno use case (docs/adr/0013). Si inietta come lo use case,
 * nello stesso request scope: le repository che si fa dare vedono la stessa
 * Unit of Work.
 */
@injectable()
export default abstract class Policy<in T> {
    abstract check(
        target: T,
        ctx: ExecutionContext,
    ): Promise<Result<void, NotAllowedError>>;

    /**
     * La policy per uno use case il cui input non è `T`: `select` ne prende
     * quello che la policy guarda, per esempio `.on((i) => i.codice)`.
     */
    static on<T, I>(
        this: PolicyClass<T>,
        select: (input: I) => T,
    ): PolicyClass<I> {
        // biome-ignore lint/complexity/noThisInStatic: si deriva la policy su cui si chiama `on`, non la base
        const Base = this as unknown as new (
            ...args: never[]
        ) => {
            check(
                target: unknown,
                ctx: ExecutionContext,
            ): Promise<Result<void, NotAllowedError>>;
        };
        @injectable()
        class On extends Base {
            override check(input: I, ctx: ExecutionContext) {
                return super.check(select(input), ctx);
            }
        }
        // biome-ignore lint/complexity/noThisInStatic: vedi sopra
        Object.defineProperty(On, "name", { value: this.name });
        return On;
    }
}
