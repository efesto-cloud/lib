---
"@efesto-cloud/env": patch
---

Migrate to `Result` v2: the internal `Failure<E>` casts in the env parsers are
replaced with `andThen` chaining, which is type-safe under the new homogeneous
`Failure<T, E>` generics. No public API or behavior change.
