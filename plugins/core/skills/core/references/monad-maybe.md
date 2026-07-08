# `Maybe<T>`

The optional-value type. From `@efesto-cloud/maybe`. Used at boundaries
where a value's absence is a recognised domain state.

## When to use `Maybe<T>` vs `null` vs `Result<T, E>`

| Situation | Use |
|-----------|-----|
| Repo lookup ("not found in DB") | `T | null` |
| Service-port answer whose absence carries domain meaning | `Maybe<T>` |
| Operation with a named failure reason | `Result<T, E>` |
| Optional input field | `T | undefined` |

`Maybe<T>` shines when the absence isn't a simple lookup miss but a
real state the call site has to handle deliberately. Example: an
authenticator's `resolve(token)` returning `Maybe<MemberDto>` —
"no session" is just as expected as "session present". A repo's
`findById(id)` returning `null` is fine because the call site already
treats absence as a `*NotFoundError` translation.

When in doubt, lean toward `null` for the repo boundary and `Maybe`
for service ports.

## The constructors

```ts
import Maybe from "@efesto-cloud/maybe";
// or named module-level factories:
import { some, none, maybe } from "@efesto-cloud/maybe";

const present: Maybe<string> = Maybe.some("hello");
const absent: Maybe<string> = Maybe.none();

// From a nullable value
const fromNullable: Maybe<string> = Maybe.maybe(maybeString);
// — `some` if value is non-null, `none` otherwise.
```

`Maybe` is the default export and a declaration-merged namespace, so
`import Maybe from "@efesto-cloud/maybe"` (then `Maybe.maybe(...)`) and
`import { some, none, maybe } from "@efesto-cloud/maybe"` reference the
same implementations.

`Maybe.maybe(v)` is the standard converter from `T | null | undefined`.
Use it at boundaries that receive nullable inputs. Note `Maybe<T>`
requires `T extends NonNullable<unknown>` — the wrapped type can't
itself be nullable.

## The two states

```ts
const m = Maybe.maybe(input.email);
if (m.isNone()) {
    return Result.err(new MissingEmailError());
}
// m.data : T
const email = m.data;
```

`isSome()` / `isNone()` narrow the type. Use one consistently — usually
`isNone()` because the early-return-on-absence pattern matches the
Result pattern.

Don't access `.data` before checking — TypeScript will block you, but
the runtime would also misbehave because `none()` carries no data.

## Transformations

| Method | What it does |
| --- | --- |
| `.map(fn)` | Apply `fn` to the value if `some`; stay `none` otherwise. |
| `.flatMap(fn)` / `.andThen(fn)` | Same but `fn` returns a `Maybe` (`andThen` is an alias). |
| `.filter(pred)` | Stay `some` only if `pred(value)` holds. |
| `.match(onSome, onNone)` | Collapse to a single value (some-first). |
| `.fold(onNone, onSome)` | Same as `match` but none-first argument order (compat alias). |
| `.tap(fn)` / `.tapNone(fn)` | Run a side effect when `some` / `none`; return the `Maybe`. |

```ts
const displayName = Maybe.maybe(user.nickname)
    .filter((n) => n.length > 0)
    .else(() => user.full_name)
    .data;
```

Chain `.filter` for derived absence conditions ("nickname exists and
is non-empty").

## Fallbacks

`.unwrapOr(default)` returns the raw value `T` if `some`, or the eager
`default` if `none`:

```ts
const url = Maybe.maybe(profile.website).unwrapOr("https://example.com");
```

`.else(() => default)` instead produces a `Maybe<T>` (always `some`)
with the lazily-computed default when `none`, so the chain ends with
`.data`:

```ts
const url = Maybe.maybe(profile.website)
    .else(() => "https://example.com")
    .data;
```

`.unwrapOrThrow()` returns the value if `some`, otherwise throws
`NoneError`. Use only when absence is a programmer error.

## Conversion to `Result`

`.toResult()` becomes useful when downstream code expects a `Result`:

```ts
const emailResult = Maybe.maybe(input.email)
    .toResult();
// Result<string, NoneError>
```

The error type is the library's `NoneError`. If you want a domain-
specific error, `mapError` after the conversion:

```ts
const emailResult = Maybe.maybe(input.email)
    .toResult()
    .mapError(() => new MissingEmailError());
```

## Combining

`Maybe.combine(m1, m2)` returns `Maybe<[T1, T2]>` — `some` only if
both are `some`:

```ts
const both = Maybe.combine(
    Maybe.maybe(input.email),
    Maybe.maybe(input.name),
);
if (both.isNone()) return Result.err(new MissingFieldsError());
const [email, name] = both.data;
```

## Side effects

`.tap(fn)` runs the function on the value if `some`, no-op otherwise;
`.tapNone(fn)` runs on the `none` branch. Both return the original
`Maybe` so they compose in chains:

```ts
Maybe.maybe(stripeCustomerId)
    .tap((id) => analytics.identify(id))
    .tapNone(() => analytics.track("anonymous"));
```

`.run(fn)` is a compat alias that runs on the `some` branch but
returns `void` (it does not chain) — prefer `.tap(fn)`.

## Wrapping nullish/throwing functions

`Maybe.fromThrowable(fn)` returns a new function that runs `fn` and
collapses a thrown error or a `null`/`undefined` return to `none`:

```ts
const lookup = Maybe.fromThrowable((k: string) => cache.get(k));
const value = lookup("key");  // Maybe<V>
```

## Async

For asynchronous workflows use the companion `@efesto-cloud/maybe-async`
package. `MaybeAsync<T>` wraps a `Promise<Maybe<T>>`, is `await`-able
(resolves to the underlying `Maybe<T>`), and exposes the same fluent
surface (`map`, `flatMap`/`andThen`, `filter`, `orElse`, `match`,
`tap`, `tapNone`, `unwrapOr`, `unwrapOrThrow`).

```ts
import MaybeAsync, { maybeAsync, someAsync, noneAsync, fromPromise } from "@efesto-cloud/maybe-async";

const profileM = fromPromise(fetchUser(id))  // rejection or null -> none
    .map((user) => user.profile);

const result = await profileM;  // Maybe<Profile>
```

Construct with `maybeAsync(value)`, `someAsync(value)`, `noneAsync()`,
or bridge promises with `fromPromise(p)`, `fromSafePromise(p)`, or
`fromThrowable(fn)`.

## Serialisation

```ts
const obj = m.toObject();
// { some: boolean, data: T | null }
const reconstructed = Maybe.fromObject(obj);
```

Rare to need — `Maybe` usually stays inside the function. Useful for
caching or message-bus payloads.

## Anti-patterns

- **Treating `Maybe` like `Result`.** No `isFailure()`. `Maybe` is
  presence/absence, not success/failure.
- **Accessing `.data` without checking.** Always narrow with
  `isSome()` / `isNone()` (or use `.else(...)`) first.
- **Wrapping a non-optional value.** If a value is always present,
  don't wrap it in `Maybe`. The type system already knows.

## Cross-layer where it shows up

- **Service ports**: `IMemberAuthenticator.resolveActor(req):
  Promise<Maybe<MemberDto>>` (when the resolver may return "no
  session" as a valid state).
- **Domain queries on entities**: a method like
  `pratica.findLatestEntry(): Maybe<TimesheetEntry>` if the entity
  computes a derived nullable.
- **Input parsing**: `Maybe.maybe(searchParams.get("q"))` at the
  loader to handle query strings.

## Procedure

1. Identify nullable / optional source values.
2. Convert early to `Maybe` via `Maybe.maybe(v)`.
3. Pick one handling style:
   - **Branching**: `if (m.isNone()) return ...; m.data`
   - **Functional**: `.map`, `.flatMap`, `.filter`, `.fold`
   - **Fallback**: `.else(() => default).data`
4. If the caller expects a `Result`, convert with `.toResult()` and
   `.mapError(...)`.

## Quick reference

```ts
// Construct
Maybe.some(v);
Maybe.none();
Maybe.maybe(nullableV);
Maybe.fromThrowable(fn);

// Check
m.isSome();
m.isNone();

// Access
m.data;            // after isSome() narrowed

// Transform
m.map((t) => u);
m.flatMap((t) => Maybe.some(u));   // alias: andThen
m.filter((t) => predicate);
m.match((t) => onSome, () => onNone);   // some-first
m.fold(() => onNone, (t) => onSome);    // none-first (compat alias)

// Side effect
m.tap((t) => { /* on some */ });
m.tapNone(() => { /* on none */ });

// Fallback / unwrap
m.unwrapOr(default);
m.else(() => default).data;
m.unwrapOrThrow();                 // throws NoneError when none

// Cross over
m.toResult();                      // Result<T, NoneError>
m.toResult().mapError(() => new DomainError());

// Combine
Maybe.combine(m1, m2);

// Serialise
m.toObject();
Maybe.fromObject(obj);
```
