import type Cliente from "~/entity/Cliente.js";

export default interface IClienteRepository {
    findByCodice(codice: string): Promise<Cliente | null>;
    /** Per nome. */
    findAll(): Promise<Cliente[]>;
    save(cliente: Cliente): void;
}
