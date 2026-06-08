# @efesto-cloud/maybe

## 0.1.1

### Patch Changes

- Updated dependencies [3a4912e]
  - @efesto-cloud/result@1.1.0

## 0.1.0

### Minor Changes

- af397cc: Add fluent additions to `Maybe`, all backwards-compatible:

  - New instance methods: `unwrapOr`, `unwrapOrThrow`, `tap`, `tapNone`,
    `match(onSome, onNone)`, and `andThen` (alias for `flatMap`).
  - New module-level factories alongside the existing namespace, so
    `import { some, none, maybe, fromObject, fromThrowable, combine }` and
    `Maybe.some(...)` both work from a single implementation.
  - New `fromThrowable` factory: wraps a function, returning `None` if it throws
    or returns a nullish value.
  - `Maybe<T>`, `Some`, `None`, and the plain-object shapes are now named exports.

  Existing `fold`, `run`, and `else` remain as compatibility aliases.

### Patch Changes

- Updated dependencies [af397cc]
  - @efesto-cloud/result@1.0.0

## 0.0.4

### Patch Changes

- 9e6ed47: Added Knip checks and improved exports/entrypoints of packages
- Updated dependencies [9e6ed47]
  - @efesto-cloud/result@0.0.4

## 0.0.3

### Patch Changes

- 5faeeb2: Added Documentation
- Updated dependencies [5faeeb2]
  - @efesto-cloud/result@0.0.3

## 0.0.2

### Patch Changes

- 2756f8c: Prova 0.0.2
- Updated dependencies [2756f8c]
  - @efesto-cloud/result@0.0.2
