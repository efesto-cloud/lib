import type IEntity from "./IEntity.js";

export default interface IEntityMapper<E extends IEntity, RAW> {
    from(dto: RAW): E;
    to<P extends keyof RAW = keyof RAW>(
        entity: E,
        options?: { pick?: P[] },
    ): Pick<RAW, P>;
}
