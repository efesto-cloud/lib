# @efesto-cloud/result

## 1.1.0

### Minor Changes

- 3a4912e: `ok()` can now be called with no argument, producing `Result<void, never>`. The value parameter is optional only via a dedicated zero-argument overload — supplying an explicit type argument while omitting the value (e.g. `ok<User>()`) remains a compile error. Existing calls are unaffected: when a value is passed, `T` is still inferred from it.

## 1.0.0

### Major Changes

- af397cc: `Result` v2 — class-based `Success`/`Failure` with a richer fluent surface.

  **Breaking:** `Failure` now carries the same `<T, E>` generic order as `Success`
  (was `Failure<E, T>`). Use sites typed as `Failure<E>` must be rewritten to
  `Failure<unknown, E>` (or the appropriate `T`). This homogeneous generic order
  enables symmetric narrowing and signature unification on `Result<T, E>`.

  New instance methods: `map`, `mapError`, `flatMap`/`andThen`, `orElse`, `match`,
  `tap`/`tapError`, `unwrapOr`, `unwrapOrThrow`. New module-level factories
  (`ok`, `err`, `fromThrowable`, `fromObject`, `fromZod`) are available alongside
  the `Result` namespace, backed by a single implementation. The pre-existing
  `fold`, `else`, `run`, and `toObject` remain as compatibility aliases.

## 0.0.4

### Patch Changes

- 9e6ed47: Added Knip checks and improved exports/entrypoints of packages

## 0.0.3

### Patch Changes

- 5faeeb2: Added Documentation

## 0.0.2

### Patch Changes

- 2756f8c: Prova 0.0.2
