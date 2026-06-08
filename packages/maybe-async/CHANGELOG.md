# @efesto-cloud/maybe-async

## 0.1.1

### Patch Changes

- @efesto-cloud/maybe@0.1.1

## 0.1.0

### Minor Changes

- af397cc: Initial release of `@efesto-cloud/maybe-async` — an asynchronous `Maybe<T>`
  companion to `@efesto-cloud/maybe`.

  `MaybeAsync<T>` wraps a `Promise<Maybe<T>>` and implements `PromiseLike<Maybe<T>>`,
  so it can be `await`ed directly. It mirrors the `Maybe` fluent surface
  (`map`, `flatMap`/`andThen`, `filter`, `orElse`, `match`, `tap`/`tapNone`,
  `unwrapOr`/`unwrapOrThrow`) and provides `fromPromise`, `fromSafePromise`,
  `fromThrowable`, `someAsync`, `noneAsync`, and `maybeAsync` factories. A
  rejecting promise or a nullish resolution collapses to `None`.

### Patch Changes

- Updated dependencies [af397cc]
  - @efesto-cloud/maybe@0.1.0
