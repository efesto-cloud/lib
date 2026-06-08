---
"@efesto-cloud/maybe": minor
---

Add fluent additions to `Maybe`, all backwards-compatible:

- New instance methods: `unwrapOr`, `unwrapOrThrow`, `tap`, `tapNone`,
  `match(onSome, onNone)`, and `andThen` (alias for `flatMap`).
- New module-level factories alongside the existing namespace, so
  `import { some, none, maybe, fromObject, fromThrowable, combine }` and
  `Maybe.some(...)` both work from a single implementation.
- New `fromThrowable` factory: wraps a function, returning `None` if it throws
  or returns a nullish value.
- `Maybe<T>`, `Some`, `None`, and the plain-object shapes are now named exports.

Existing `fold`, `run`, and `else` remain as compatibility aliases.
