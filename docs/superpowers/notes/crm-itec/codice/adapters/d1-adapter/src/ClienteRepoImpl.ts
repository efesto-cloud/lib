import InternalSymbols from "@itec/core/di/InternalSymbols";
import Cliente from "@itec/core/entity/Cliente";
import type IClienteRepository from "@itec/core/repo/IClienteRepository";
import { inject, injectable } from "inversify";
import type D1UnitOfWork from "~/D1UnitOfWork.js";

interface ClienteRow {
    codice: string;
    nome: string;
    v: number;
}

const toCliente = ({ codice, v, ...props }: ClienteRow) =>
    new Cliente(codice, props, v);

@injectable()
export default class ClienteRepoImpl implements IClienteRepository {
    private readonly db: D1Database;

    constructor(
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: D1UnitOfWork,
    ) {
        this.db = uow.db;
    }

    async findByCodice(codice: string): Promise<Cliente | null> {
        const row = await this.db
            .prepare(`SELECT * FROM "Cliente" WHERE codice = ?`)
            .bind(codice)
            .first<ClienteRow>();
        return row && toCliente(row);
    }

    async findAll(): Promise<Cliente[]> {
        const { results } = await this.db
            .prepare(`SELECT * FROM "Cliente" ORDER BY nome COLLATE NOCASE`)
            .all<ClienteRow>();
        return results.map(toCliente);
    }

    save(cliente: Cliente): void {
        this.uow.save(cliente, () => [
            cliente.isNew()
                ? this.db
                      .prepare(
                          `INSERT INTO "Cliente" (codice, nome, v) VALUES (?, ?, 1)`,
                      )
                      .bind(cliente.codice, cliente.nome)
                : this.db
                      .prepare(
                          `UPDATE "Cliente" SET nome = ?, v = CASE WHEN v = ? THEN v + 1 END WHERE codice = ?`,
                      )
                      .bind(cliente.nome, cliente.v, cliente.codice),
        ]);
    }
}
