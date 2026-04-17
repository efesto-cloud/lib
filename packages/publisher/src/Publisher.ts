import type IPublisher from "./IPublisher.js";
import type { Subscriber, Unsubscribe } from "./IPublisher.js";

export default class Publisher<ARGS extends unknown[] = []>
    implements IPublisher<ARGS>
{
    subscribers: Array<Subscriber<ARGS>>;

    constructor() {
        this.subscribers = [];
    }

    get size(): number {
        return this.subscribers.length;
    }

    subscribe(s: Subscriber<ARGS>): Unsubscribe {
        const l = this.subscribers.push(s);
        return () => this.unsubscribe(l - 1);
    }

    unsubscribe(id: number): void {
        this.subscribers.splice(id, 1);
    }

    notify(...args: ARGS): void {
        this.subscribers.forEach((s) => {
            s(...args);
        });
    }

    unsubscribeAll(): void {
        this.subscribers = [];
    }
}
