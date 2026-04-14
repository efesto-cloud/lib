export default interface IDatabaseContext {
    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
