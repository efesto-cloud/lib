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

const present: Maybe<string> = Maybe.some("hello");
const absent: Maybe<string> = Maybe.none();

// From a nullable value
const fromNullable: Maybe<string> = Maybe.maybe(maybeString);
// — `some` if value is non-null, `none` otherwise.
```

`Maybe.maybe(v)` is the standard converter from `T | null | undefined`.
Use it at boundaries that receive nullable inputs.

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
|--------|-------------|
| `.map(fn)` | Apply `fn` to the value if `some`; stay `none` otherwise. |
| `.flatMap(fn)` | Same but `fn` returns a `Maybe`. |
| `.filter(pred)` | Stay `some` only if `pred(value)` holds. |
| `.fold(onNone, onSome)` | Collapse to a single value. |

```ts
const displayName = Maybe.maybe(user.nickname)
    .filter((n) => n.length > 0)
    .else(() => user.full_name)
    .data;
```

Chain `.filter` for derived absence conditions ("nickname exists and
is non-empty").

## Fallbacks

`.else(() => default)` produces a `Maybe<T>` with the default value
when `none`:

```ts
const url = Maybe.maybe(profile.website)
    .else(() => "https://example.com")
    .data;
```

The result of `.else(...)` is always `some` (the value), so `.data`
is safe.

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

`.run(fn)` runs the function on the value if `some`, no-op otherwise:

```ts
Maybe.maybe(stripeCustomerId).run((id) => analytics.identify(id));
```

Returns the original `Maybe` so it composes in chains.

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

// Check
m.isSome();
m.isNone();

// Access
m.data;            // after isSome() narrowed

// Transform
m.map((t) => u);
m.flatMap((t) => Maybe.some(u));
m.filter((t) => predicate);
m.fold(() => onNone, (t) => onSome);

// Side effect
m.run((t) => { /* ... */ });

// Fallback / unwrap
m.else(() => default).data;

// Cross over
m.toResult();
m.toResult().mapError(() => new DomainError());

// Combine
Maybe.combine(m1, m2);

// Serialise
m.toObject();
Maybe.fromObject(obj);
```
