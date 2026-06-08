# @efesto-cloud/result-async

## 0.1.0

### Minor Changes

- af397cc: Initial release of `@efesto-cloud/result-async` — an asynchronous `Result<T, E>`
  companion to `@efesto-cloud/result`.

  `ResultAsync<T, E>` wraps a `Promise<Result<T, E>>` and implements
  `PromiseLike<Result<T, E>>`, so it can be `await`ed directly. It mirrors the
  `Result` fluent surface (`map`, `mapError`, `flatMap`/`andThen`, `orElse`,
  `match`, `tap`/`tapError`, `unwrapOr`/`unwrapOrThrow`) and provides
  `fromPromise`, `fromSafePromise`, `fromThrowable`, `okAsync`, and `errAsync`
  factories. The wrapped promise never rejects — all error paths are captured as
  `Failure`.

### Patch Changes

- Updated dependencies [af397cc]
  - @efesto-cloud/result@1.0.0
