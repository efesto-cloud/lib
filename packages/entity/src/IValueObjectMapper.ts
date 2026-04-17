export default interface IValueObjectMapper<E extends object, RAW> {
    from(dto: RAW): E;
    to<P extends keyof RAW = keyof RAW>(
        entity: E,
        options?: { pick?: P[] },
    ): Pick<RAW, P>;
}
