import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import Cliente from "@itec/core/entity/Cliente";
import Commessa from "@itec/core/entity/Commessa";
import type Entity from "@itec/core/entity/Entity";
import Offerta from "@itec/core/entity/Offerta";
import ProbeStatus from "@itec/core/entity/ProbeStatus";
import RagioneSociale from "@itec/core/entity/RagioneSociale";
import TentativiAccesso from "@itec/core/entity/TentativiAccesso";
import Utente from "@itec/core/entity/Utente";
import { BUDGET_VUOTO } from "@itec/core/rule/budget";
import { CHECKLIST_VUOTA } from "@itec/core/rule/checklist";
import { LOGISTICA_VUOTA } from "@itec/core/rule/logistica";
import { SOLLECITI_VUOTI } from "@itec/core/rule/solleciti";
import ClienteRepoImpl from "@itec/d1-adapter/ClienteRepoImpl";
import CommessaRepoImpl from "@itec/d1-adapter/CommessaRepoImpl";
import D1UnitOfWork from "@itec/d1-adapter/D1UnitOfWork";
import OffertaRepoImpl from "@itec/d1-adapter/OffertaRepoImpl";
import ProbeStatusRepoImpl from "@itec/d1-adapter/ProbeStatusRepoImpl";
import RagioneSocialeRepoImpl from "@itec/d1-adapter/RagioneSocialeRepoImpl";
import TentativiAccessoRepoImpl from "@itec/d1-adapter/TentativiAccessoRepoImpl";
import UtenteRepoImpl from "@itec/d1-adapter/UtenteRepoImpl";
import { Result } from "better-result";
import { beforeAll, describe, expect, it } from "vitest";

const T0 = new Date("2026-11-11T09:00:00.000Z");

const nuovoUtente = (id: string = crypto.randomUUID()) =>
    new Utente(
        id,
        {
            username: `u-${crypto.randomUUID()}`,
            nome: "Mario",
            cognome: "Rossi",
            email: null,
            amministratore: false,
            ruoli: ["pm"],
            bu: ["FF"],
            password_hash: "hash",
            cambio_password: false,
            password_changed_at: null,
            created_at: T0.toISOString(),
            deleted_at: null,
        },
        0,
    );

/** Salva con una Unit of Work sua, come uno use case a sé. */
function salva(save: (uow: D1UnitOfWork) => void) {
    const uow = new D1UnitOfWork(env.DB);
    return uow.runWithTransaction(async () => {
        save(uow);
        return Result.ok();
    });
}

const utenti = () => new UtenteRepoImpl(new D1UnitOfWork(env.DB));

async function leggiUtente(id: string): Promise<Utente> {
    const utente = await utenti().findById(id);
    if (!utente) throw new Error(`manca l'utente ${id}`);
    return utente;
}

let utente_id: string;

/** Un codice di tre caratteri che nessun altro test usa. */
let codici = 0;
const nuovoCodice = () => `Q${String(codici++).padStart(2, "0")}`;

beforeAll(async () => {
    await applyD1Migrations(env.DB, env.MIGRATIONS);
    const utente = nuovoUtente();
    (await salva((uow) => new UtenteRepoImpl(uow).save(utente))).unwrap();
    utente_id = utente.id;
    for (const codice of ["CLA", "CLB"])
        (
            await salva((uow) =>
                new ClienteRepoImpl(uow).save(
                    Cliente.create({ codice, nome: codice }).unwrap(),
                ),
            )
        ).unwrap();
});

interface Caso<E extends Entity<unknown, unknown>> {
    /** Senza `id`, uno nuovo; lo stato della sonda ha sempre lo stesso. */
    nuova(id?: E["id"]): E;
    find(uow: D1UnitOfWork, id: E["id"]): Promise<E | null>;
    save(uow: D1UnitOfWork, entity: E): void;
    cambia(entity: E): void;
}

/** Il patto del `save` (docs/adr/0011): ogni repository di entity lo passa. */
function pattoDelSave<E extends Entity<unknown, unknown>>(
    nome: string,
    caso: Caso<E>,
) {
    describe(`il save di ${nome}`, () => {
        const leggi = (id: E["id"]) => caso.find(new D1UnitOfWork(env.DB), id);
        const salvaEntity = (entity: E) =>
            salva((uow) => caso.save(uow, entity));

        async function salvata(): Promise<E> {
            const nuova = caso.nuova();
            if (!(await leggi(nuova.id))) (await salvaEntity(nuova)).unwrap();
            const letta = await leggi(nuova.id);
            if (!letta) throw new Error("l'entity salvata non si rilegge");
            return letta;
        }

        it("inserisce l'entity nuova, che riletta ha la versione 1", async () => {
            const nuova = caso.nuova();
            (await salvaEntity(nuova)).unwrap();

            expect((await leggi(nuova.id))?.v).toBe(1);
        });

        it("non sovrascrive con un'entity nuova una riga che c'è già: è un conflitto", async () => {
            const esistente = await salvata();

            const result = await salvaEntity(caso.nuova(esistente.id));

            expect(result.isErr() && result.error._tag).toBe("ConflictError");
            expect((await leggi(esistente.id))?.v).toBe(esistente.v);
        });

        it("salva dalla versione letta, e da una versione vecchia è un conflitto", async () => {
            const { id, v } = await salvata();
            const prima = await leggi(id);
            const seconda = await leggi(id);
            if (!prima || !seconda) throw new Error("manca l'entity");

            caso.cambia(prima);
            (await salvaEntity(prima)).unwrap();
            caso.cambia(seconda);
            const result = await salvaEntity(seconda);

            expect(result.isErr() && result.error._tag).toBe("ConflictError");
            expect((await leggi(id))?.v).toBe(v + 1);
        });
    });
}

pattoDelSave<Utente>("Utente", {
    nuova: nuovoUtente,
    find: (uow, id) => new UtenteRepoImpl(uow).findById(id),
    save: (uow, utente) => new UtenteRepoImpl(uow).save(utente),
    cambia: (utente) => utente.setPassword("altro-hash", true),
});

pattoDelSave<TentativiAccesso>("TentativiAccesso", {
    nuova: (username = crypto.randomUUID()) =>
        TentativiAccesso.create(username, T0),
    find: (uow, username) => new TentativiAccessoRepoImpl(uow).find(username),
    save: (uow, tentativi) => new TentativiAccessoRepoImpl(uow).save(tentativi),
    cambia: (tentativi) => tentativi.fail(T0),
});

pattoDelSave<ProbeStatus>("ProbeStatus", {
    nuova: () =>
        ProbeStatus.create({
            received_at: T0.toISOString(),
            sent_at: T0.toISOString(),
            state: "operational",
            reason: null,
            version: "sha-1234567",
            started_at: T0.toISOString(),
            arca: { adapter: "stub", status: "ok", reason: null },
            last_sync: null,
        }),
    find: (uow) => new ProbeStatusRepoImpl(uow).findLatest(),
    save: (uow, status) => new ProbeStatusRepoImpl(uow).save(status),
    cambia: (status) =>
        status.update({
            ...status.toDTO(),
            received_at: new Date().toISOString(),
        }),
});

pattoDelSave<Cliente>("Cliente", {
    nuova: (codice = nuovoCodice()) =>
        Cliente.create({ codice, nome: "Saipem S.p.A." }).unwrap(),
    find: (uow, codice) => new ClienteRepoImpl(uow).findByCodice(codice),
    save: (uow, cliente) => new ClienteRepoImpl(uow).save(cliente),
    cambia: (cliente) => cliente.rename("Saipem").unwrap(),
});

/** Un'offerta con un progressivo che nessun'altra ha. */
let progressivi = 0;
const nuovaOfferta = (codice?: string) => {
    const progressivo = ++progressivi;
    return new Offerta(
        codice ?? `O2026${String(progressivo).padStart(4, "0")}CLAMIFF`,
        {
            progressivo,
            fase: "in_redazione",
            oggetto: "Impianto antincendio",
            codice_cliente: "CLA",
            bu: "FF",
            tipo_gara: "gara",
            provincia: "MI",
            valore: null,
            probabilita: null,
            referente: null,
            email: null,
            telefono: null,
            scadenza: null,
            numero_gara: null,
            data_gara: null,
            ribasso: null,
            note: null,
            offerta_arca: null,
            bp_id: utente_id,
            pm_id: null,
            budget: BUDGET_VUOTO,
            archiviazione: null,
            convertita_in: null,
            extra: null,
        },
        0,
    );
};

pattoDelSave<Offerta>("Offerta", {
    nuova: nuovaOfferta,
    find: (uow, codice) => new OffertaRepoImpl(uow).findByCodice(codice),
    save: (uow, offerta) => new OffertaRepoImpl(uow).save(offerta),
    cambia: (offerta) =>
        offerta
            .update({ ...offerta.toDTO(), oggetto: "Impianto rivelazione" })
            .unwrap(),
});

/** Una commessa con un progressivo che nessun'altra ha. */
const nuovaCommessa = (codice?: string) => {
    const progressivo = ++progressivi;
    return new Commessa(
        codice ?? `C2026${String(progressivo).padStart(4, "0")}CLAMIFF`,
        {
            progressivo,
            fase: "da_programmare",
            archiviazione: null,
            codice_offerta: null,
            descrizione: "Manutenzione impianti",
            riferimento_cliente: null,
            codice_cliente: "CLA",
            codice_ragione_sociale: null,
            bu: "FF",
            tipo_gara: "contratto",
            provincia: "MI",
            valore: null,
            referente: null,
            email: null,
            telefono: null,
            note: null,
            livello_budget: null,
            livello_logistica: null,
            extra_a_contratto: true,
            bp_id: null,
            op_id: null,
            pm_id: utente_id,
            ing_ids: [],
            budget: BUDGET_VUOTO,
            sottocommesse: [],
            valore_visibile: true,
            budget_congelato: false,
            autorizzatore_id: null,
            acquisti: [],
            logistica: LOGISTICA_VUOTA,
            milestone: [],
            documenti: [],
            checklist: CHECKLIST_VUOTA,
            solleciti: SOLLECITI_VUOTI,
        },
        0,
    );
};

pattoDelSave<Commessa>("Commessa", {
    nuova: nuovaCommessa,
    find: (uow, codice) => new CommessaRepoImpl(uow).findByCodice(codice),
    save: (uow, commessa) => new CommessaRepoImpl(uow).save(commessa),
    cambia: (commessa) => commessa.addSottocommessa("sito").unwrap(),
});

pattoDelSave<RagioneSociale>("RagioneSociale", {
    nuova: (codice_arca = crypto.randomUUID()) =>
        RagioneSociale.create(codice_arca, "CLA"),
    find: (uow, codice_arca) =>
        new RagioneSocialeRepoImpl(uow).findByCodiceArca(codice_arca),
    save: (uow, ragioneSociale) =>
        new RagioneSocialeRepoImpl(uow).save(ragioneSociale),
    cambia: (ragioneSociale) => ragioneSociale.assign("CLB"),
});

describe("la coda di scritture su D1", () => {
    it("col conflitto annulla anche le altre scritture della sua coda", async () => {
        const prima = await leggiUtente(utente_id);
        const seconda = await leggiUtente(utente_id);
        prima.setPassword("di-anna", false);
        (await salva((uow) => new UtenteRepoImpl(uow).save(prima))).unwrap();

        seconda.setPassword("di-bruno", false);
        const result = await salva((uow) => {
            new TentativiAccessoRepoImpl(uow).save(
                TentativiAccesso.create("nella-stessa-coda", T0),
            );
            new UtenteRepoImpl(uow).save(seconda);
        });

        expect(result.isErr() && result.error._tag).toBe("ConflictError");
        expect((await leggiUtente(utente_id)).password_hash).toBe("di-anna");
        expect(
            await new TentativiAccessoRepoImpl(new D1UnitOfWork(env.DB)).find(
                "nella-stessa-coda",
            ),
        ).toBeNull();
    });

    it("dopo un conflitto ripete da capo, e il risultato parte dallo stato nuovo", async () => {
        const uow = new D1UnitOfWork(env.DB);
        const repo = new UtenteRepoImpl(uow);
        let tentativi = 0;

        const result = await uow.runWithTransaction(async () => {
            tentativi++;
            const utente = await repo.findById(utente_id);
            if (!utente) throw new Error("manca l'utente");
            if (tentativi === 1) {
                const altro = await leggiUtente(utente_id);
                altro
                    .update({
                        nome: "Carla",
                        cognome: altro.cognome,
                        email: altro.email,
                        amministratore: altro.amministratore,
                        ruoli: [...altro.ruoli],
                        bu: [...altro.bu],
                    })
                    .unwrap();
                (
                    await salva((other) =>
                        new UtenteRepoImpl(other).save(altro),
                    )
                ).unwrap();
            }
            utente.setPassword("dopo-il-conflitto", false);
            repo.save(utente);
            return Result.ok(utente.toDTO());
        });

        expect(tentativi).toBe(2);
        expect(result.unwrap().nome).toBe("Carla");
        expect(await leggiUtente(utente_id)).toMatchObject({
            nome: "Carla",
            password_hash: "dopo-il-conflitto",
        });
    });

    it("una riga cancellata nel frattempo è un conflitto, che non si ripete: il resto della coda resta scritto", async () => {
        const falliti = TentativiAccesso.create(crypto.randomUUID(), T0);
        (
            await salva((uow) =>
                new TentativiAccessoRepoImpl(uow).save(falliti),
            )
        ).unwrap();
        const uow = new D1UnitOfWork(env.DB);
        const repo = new TentativiAccessoRepoImpl(uow);
        let tentativi = 0;

        const result = await uow.runWithTransaction(async () => {
            tentativi++;
            const letti = await repo.find(falliti.id);
            if (!letti) throw new Error("mancano i tentativi");
            const altri = await new TentativiAccessoRepoImpl(
                new D1UnitOfWork(env.DB),
            ).find(falliti.id);
            if (!altri) throw new Error("mancano i tentativi");
            altri.reset();
            (
                await salva((other) =>
                    new TentativiAccessoRepoImpl(other).save(altri),
                )
            ).unwrap();
            letti.fail(T0);
            repo.save(letti);
            repo.save(TentativiAccesso.create("scritto-comunque", T0));
            return Result.ok();
        });

        expect(result.isErr() && result.error._tag).toBe("ConflictError");
        expect(tentativi).toBe(1);
        expect(
            await new TentativiAccessoRepoImpl(new D1UnitOfWork(env.DB)).find(
                "scritto-comunque",
            ),
        ).not.toBeNull();
    });
});
