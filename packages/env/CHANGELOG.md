# @efesto-cloud/env

## 0.0.5

### Patch Changes

- af397cc: Migrate to `Result` v2: the internal `Failure<E>` casts in the env parsers are
  replaced with `andThen` chaining, which is type-safe under the new homogeneous
  `Failure<T, E>` generics. No public API or behavior change.
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
