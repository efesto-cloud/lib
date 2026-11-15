import ClienteWithoutNomeError from "@itec/contract/errors/ClienteWithoutNomeError";
import InvalidCodiceClienteError from "@itec/contract/errors/InvalidCodiceClienteError";
import type ICliente from "@itec/contract/interface/ICliente";
import { Result } from "better-result";
import Entity from "~/entity/Entity.js";

export interface ClienteProps {
    nome: string;
}

const CODICE = /^[A-Z0-9]{3}$/;

/** Le tre lettere da `start`, completate con X (`_autoCodCli`). */
const tre = (lettere: string, start: number) =>
    `${lettere.slice(start, start + 3)}XXX`.slice(0, 3);

/** I codici da provare, nell'ordine di `_uniqueAutoCodCli`. */
function* candidati(nome: string) {
    const lettere = nome.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    for (let start = 0; start <= Math.max(1, lettere.length - 2); start++)
        yield tre(lettere, start);
    for (const c of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        yield `${tre(lettere, 0).slice(0, 2)}${c}`;
    for (let n = 1; ; n++) yield `X${String(n).padStart(2, "0")}`;
}

/** L'`id` è il codice di tre caratteri, unico, che non cambia. */
export default class Cliente extends Entity<ClienteProps> {
    /** Le prime tre lettere del nome, o la prima variante libera. */
    static suggestCodice(nome: string, presi: ReadonlySet<string>): string {
        for (const codice of candidati(nome))
            if (!presi.has(codice)) return codice;
        throw new Error("irraggiungibile");
    }

    static create(input: {
        codice: string;
        nome: string;
    }): Result<Cliente, ClienteWithoutNomeError | InvalidCodiceClienteError> {
        const codice = input.codice.trim().toUpperCase();
        if (!CODICE.test(codice))
            return Result.err(new InvalidCodiceClienteError());
        const cliente = new Cliente(codice, { nome: "" }, 0);
        const renamed = cliente.rename(input.nome);
        if (renamed.isErr()) return Result.err(renamed.error);
        return Result.ok(cliente);
    }

    get codice() {
        return this.id;
    }
    get nome() {
        return this.props.nome;
    }

    rename(nome: string): Result<void, ClienteWithoutNomeError> {
        const trimmed = nome.trim();
        if (!trimmed) return Result.err(new ClienteWithoutNomeError());
        this.props.nome = trimmed;
        return Result.ok();
    }

    toDTO(): ICliente {
        return { codice: this.id, nome: this.props.nome };
    }
}
