---
"@efesto-cloud/toast": major
---

`Toast` v2 — align with `Result` v2.

**Breaking:** `ToastFailure` now carries the same `<T, E>` generic order as
`ToastSuccess` (was `ToastFailure<E, T>`). Use sites typed as `ToastFailure<E>`
must be rewritten to `ToastFailure<unknown, E>` (or the appropriate `T`). The
`Toast<T, E>` union is now homogeneous, enabling symmetric narrowing.

New instance methods: `mapError`, `andThen`, `orElse`, `match`, `tap`,
`tapError`, `unwrapOr`. New module-level factories (`ok`, `err`, `fromObject`,
`fromResult`) are available alongside the `Toast` namespace, backed by a single
implementation. The contained `message` is preserved across `map`/`mapError`/
`tap`. The pre-existing `fold`, `else`, `run`, `toObject`, and `toMaybe` remain.
