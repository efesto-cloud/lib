---
"@efesto-cloud/result": minor
---

`ok()` can now be called with no argument, producing `Result<void, never>`. The value parameter is optional only via a dedicated zero-argument overload — supplying an explicit type argument while omitting the value (e.g. `ok<User>()`) remains a compile error. Existing calls are unaffected: when a value is passed, `T` is still inferred from it.
