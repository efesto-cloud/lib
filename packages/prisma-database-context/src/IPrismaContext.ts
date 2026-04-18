import type { IDatabaseContext } from "@efesto-cloud/database-context";

export type PrismaTxKeys =
    | "$connect"
    | "$disconnect"
    | "$on"
    | "$transaction"
    | "$use"
    | "$extends";

export interface PrismaLikeClient<TTx = object> {
    $transaction<T>(fn: (tx: TTx) => Promise<T>): Promise<T>;
}

export type PrismaTxOf<TClient> = Omit<TClient, PrismaTxKeys>;

export default interface IPrismaContext<
    TClient extends PrismaLikeClient<PrismaTxOf<TClient>> = PrismaLikeClient,
> extends IDatabaseContext {
    readonly client: TClient | PrismaTxOf<TClient>;
}
