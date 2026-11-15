const InternalSymbols = {
    UnitOfWork: Symbol.for("UnitOfWork"),

    Config: {
        SogliaAutorizzazione: Symbol.for("Config.SogliaAutorizzazione"),
    },

    Repo: {
        ArcaMirror: Symbol.for("Repo.ArcaMirror"),
        Cliente: Symbol.for("Repo.Cliente"),
        Commessa: Symbol.for("Repo.Commessa"),
        Fornitore: Symbol.for("Repo.Fornitore"),
        NaturaCostoConto: Symbol.for("Repo.NaturaCostoConto"),
        Offerta: Symbol.for("Repo.Offerta"),
        Passaggio: Symbol.for("Repo.Passaggio"),
        Permesso: Symbol.for("Repo.Permesso"),
        ProbeStatus: Symbol.for("Repo.ProbeStatus"),
        RagioneSociale: Symbol.for("Repo.RagioneSociale"),
        SottocommessaArca: Symbol.for("Repo.SottocommessaArca"),
        TentativiAccesso: Symbol.for("Repo.TentativiAccesso"),
        Utente: Symbol.for("Repo.Utente"),
    },

    Service: {
        ArcaErp: Symbol.for("Service.ArcaErp"),
        CloudPush: Symbol.for("Service.CloudPush"),
        PasswordHasher: Symbol.for("Service.PasswordHasher"),
    },
} as const;

export default InternalSymbols;
