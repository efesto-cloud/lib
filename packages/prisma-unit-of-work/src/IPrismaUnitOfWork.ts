import type { IUnitOfWork } from "@efesto-cloud/unit-of-work";

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

export default interface IPrismaUnitOfWork<
    TClient extends PrismaLikeClient<PrismaTxOf<TClient>> = PrismaLikeClient,
> extends IUnitOfWork {
    readonly client: TClient | PrismaTxOf<TClient>;
}
