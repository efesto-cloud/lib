import { type IPublisher, Publisher } from "@efesto-cloud/publisher";
import type IObservable from "./IObservable.js";

export default class Observable<T> implements IObservable<T> {
    private _value: T;
    public readonly onchange: IPublisher<[T]> = new Publisher();

    constructor(initialState: T) {
        this._value = initialState;
    }

    get(): T {
        return this._value;
    }

    set(value: T): void {
        this._value = value;
        this.onchange.notify(value);
    }

    subscribe(callback: (value: T) => void) {
        return this.onchange.subscribe(callback);
    }

    dispose(): void {
        this.onchange.unsubscribeAll();
    }
}
