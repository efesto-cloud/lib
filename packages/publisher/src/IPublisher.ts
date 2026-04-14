export type Subscriber<ARGS extends unknown[]> = (...args: ARGS) => void;

export type Unsubscribe = () => void;

export default interface IPublisher<ARGS extends unknown[]> {
    size: number;
    subscribe(s: Subscriber<ARGS>): Unsubscribe;
    unsubscribe(id: number): void;
    notify(...args: ARGS): void;
    unsubscribeAll(): void;
}
