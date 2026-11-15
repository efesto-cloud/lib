import type ClienteWithoutNomeError from "@itec/contract/errors/ClienteWithoutNomeError";
import CodiceClienteTakenError from "@itec/contract/errors/CodiceClienteTakenError";
import type ConflictError from "@itec/contract/errors/ConflictError";
import type InvalidCodiceClienteError from "@itec/contract/errors/InvalidCodiceClienteError";
import RagioneSocialeNotFoundError from "@itec/contract/errors/RagioneSocialeNotFoundError";
import type ICliente from "@itec/contract/interface/ICliente";
import type ICreateCliente from "@itec/contract/useCase/clienti/ICreateCliente";
import type { CreateClienteInput } from "@itec/contract/useCase/clienti/ICreateCliente";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import InternalSymbols from "~/di/InternalSymbols.js";
import Cliente from "~/entity/Cliente.js";
import type IArcaMirrorRepository from "~/repo/IArcaMirrorRepository.js";
import type IClienteRepository from "~/repo/IClienteRepository.js";
import type IRagioneSocialeRepository from "~/repo/IRagioneSocialeRepository.js";
import type IUnitOfWork from "~/repo/IUnitOfWork.js";
import { attribuisci } from "./attribuisci.js";
import { CODICI_DEI_GRUPPI } from "./proposta.js";

@injectable()
export default class CreateCliente implements ICreateCliente {
    constructor(
        @inject(InternalSymbols.UnitOfWork)
        private readonly uow: IUnitOfWork,
        @inject(InternalSymbols.Repo.ArcaMirror)
        private readonly specchio: IArcaMirrorRepository,
        @inject(InternalSymbols.Repo.Cliente)
        private readonly clienti: IClienteRepository,
        @inject(InternalSymbols.Repo.RagioneSociale)
        private readonly ragioniSociali: IRagioneSocialeRepository,
    ) {}

    async execute({
        nome,
        codice,
        codice_arca,
    }: CreateClienteInput): Promise<
        Result<
            ICliente,
            | ClienteWithoutNomeError
            | CodiceClienteTakenError
            | ConflictError
            | InvalidCodiceClienteError
            | RagioneSocialeNotFoundError
        >
    > {
        return this.uow.runWithTransaction(async () => {
            // Il codice unico è una regola fra righe: se un altro lo prende
            // nel frattempo, il vincolo del database fa ripetere da qui.
            const presi = new Set(
                (await this.clienti.findAll()).map((c) => c.codice),
            );
            const cliente = Cliente.create({
                codice:
                    codice?.trim() ||
                    Cliente.suggestCodice(
                        nome,
                        new Set([...presi, ...CODICI_DEI_GRUPPI]),
                    ),
                nome,
            });
            if (cliente.isErr()) return Result.err(cliente.error);
            if (presi.has(cliente.value.codice))
                return Result.err(new CodiceClienteTakenError());
            if (
                codice_arca !== null &&
                !(await this.specchio.findClienteCF(codice_arca))
            )
                return Result.err(new RagioneSocialeNotFoundError());

            this.clienti.save(cliente.value);
            if (codice_arca !== null)
                await attribuisci(
                    this.ragioniSociali,
                    codice_arca,
                    cliente.value.codice,
                );
            return Result.ok(cliente.value.toDTO());
        });
    }
}
