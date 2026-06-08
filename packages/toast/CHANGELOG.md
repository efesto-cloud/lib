# @efesto-cloud/toast

## 1.0.0

### Major Changes

- af397cc: `Toast` v2 — align with `Result` v2.

  **Breaking:** `ToastFailure` now carries the same `<T, E>` generic order as
  `ToastSuccess` (was `ToastFailure<E, T>`). Use sites typed as `ToastFailure<E>`
  must be rewritten to `ToastFailure<unknown, E>` (or the appropriate `T`). The
  `Toast<T, E>` union is now homogeneous, enabling symmetric narrowing.

  New instance methods: `mapError`, `andThen`, `orElse`, `match`, `tap`,
  `tapError`, `unwrapOr`. New module-level factories (`ok`, `err`, `fromObject`,
  `fromResult`) are available alongside the `Toast` namespace, backed by a single
  implementation. The contained `message` is preserved across `map`/`mapError`/
  `tap`. The pre-existing `fold`, `else`, `run`, `toObject`, and `toMaybe` remain.

### Patch Changes

- Updated dependencies [af397cc]
- Updated dependencies [af397cc]
  - @efesto-cloud/maybe@0.1.0
  - @efesto-cloud/result@1.0.0

## 0.0.4

### Patch Changes

- 9e6ed47: Added Knip checks and improved exports/entrypoints of packages
- Updated dependencies [9e6ed47]
  - @efesto-cloud/result@0.0.4
  - @efesto-cloud/maybe@0.0.4

## 0.0.3

### Patch Changes

- 5faeeb2: Added Documentation
- Updated dependencies [5faeeb2]
  - @efesto-cloud/result@0.0.3
  - @efesto-cloud/maybe@0.0.3

## 0.0.2

### Patch Changes

- a88afe4: Toast monad
