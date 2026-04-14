import type IComputedObservable from "./IComputedObservable.js";
import type { IObservable } from "@efesto-cloud/observable";
import type IPublisher from "@efesto-cloud/publisher/IPublisher";
import type { Unsubscribe } from "@efesto-cloud/publisher/IPublisher";
import PublisherImpl from "@efesto-cloud/publisher/PublisherImpl";

export default class ComputedObservableImpl<T, DEPS extends unknown[]>
  implements IComputedObservable<T>
{
  private _value: T;
  private readonly onchange: IPublisher<[T]> = new PublisherImpl();
  private readonly unsubscribers: Array<Unsubscribe> = [];
  private readonly dependencies: { [K in keyof DEPS]: IObservable<DEPS[K]> };
  private readonly computeFn: (values: DEPS) => T;

  constructor(
    dependencies: { [K in keyof DEPS]: IObservable<DEPS[K]> },
    computeFn: (values: DEPS) => T
  ) {
    this.dependencies = dependencies;
    this.computeFn = computeFn;

    this._value = this.compute();
    this.unsubscribers = dependencies.map((d) => d.subscribe(() => this.recompute()));
  }

  private compute(): T {
    const values = this.dependencies.map((dep) => dep.get()) as DEPS;
    return this.computeFn(values);
  }

  private recompute(): void {
    const newValue = this.compute();

    if (newValue !== this._value) {
      this._value = newValue;
      this.onchange.notify(newValue);
    }
  }

  get(): T {
    return this._value;
  }

  set(_value: T): void {}

  subscribe(callback: (value: T) => void): Unsubscribe {
    return this.onchange.subscribe(callback);
  }

  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.onchange.unsubscribeAll();
  }
}
