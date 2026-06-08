export default interface IUnitOfWork {
    runWithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
