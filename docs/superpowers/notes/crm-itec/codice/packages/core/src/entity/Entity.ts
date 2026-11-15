/**
 * La base delle entity (docs/adr/0011). `v` è la versione della riga letta:
 * 0 per un'entity nuova, poi la carica il mapper della repository, e il
 * salvataggio la controlla. Lo use case non la tocca.
 */
export default abstract class Entity<P, Id = string> {
    private removed = false;

    constructor(
        readonly id: Id,
        protected props: P,
        readonly v: number,
    ) {}

    isNew(): boolean {
        return this.v === 0;
    }

    /** Il prossimo `save` la cancella davvero. */
    isRemoved(): boolean {
        return this.removed;
    }

    /** Solo per le entity che il dominio cancella davvero, senza `deleted_at`. */
    protected remove(): void {
        this.removed = true;
    }
}
