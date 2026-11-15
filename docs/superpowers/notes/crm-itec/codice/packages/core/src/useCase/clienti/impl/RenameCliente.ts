import ClienteNotFoundError from "@itec/contract/errors/ClienteNotFoundError";
import type ClienteWithoutNomeError from "@itec/contract/errors/ClienteWithoutNomeError";
import type ConflictError from "@itec/contract/errors/ConflictError";
import type IRenameCliente from "@itec/contract/useCase/clienti/IRenameCliente";
import type { RenameClienteInput } from "@itec/contract/useCase/clienti/IRenameCliente";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import InternalSymbols from "~/di/InternalSymbols.js";
import type IClienteRepository from "~/repo/IClienteRepository.js";
import type IUnitOfWork from "~/repo/IUnitOfWork.js";

@injectable()
export default class RenameCliente implements IRenameCliente {
    constructor(
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: IUnitOfWork,
        @inject(InternalSymbols.Repo.Cliente)
        private readonly clienti: IClienteRepository,
    ) {}

    async execute({
        codice,
        nome,
    }: RenameClienteInput): Promise<
        Result<
            void,
            ClienteNotFoundError | ClienteWithoutNomeError | ConflictError
        >
    > {
        return this.uow.runWithTransaction(async () => {
            const cliente = await this.clienti.findByCodice(codice);
            if (!cliente) return Result.err(new ClienteNotFoundError());
            const renamed = cliente.rename(nome);
            if (renamed.isErr()) return renamed;
            this.clienti.save(cliente);
            return Result.ok();
        });
    }
}
