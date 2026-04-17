import type { Unsubscribe } from "@efesto-cloud/publisher/IPublisher";

export default interface IObservable<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Unsubscribe;
    dispose(): void;
}
