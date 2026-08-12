# Value object

Domain primitives. Immutable wrappers that encapsulate validation and
normalisation rules for a single concept (email, money, ID, status
code, …). Live in `core/src/value_object/`.

## When to make a value object

Use a value object when **any** of these is true:

- The concept has validation rules (regex, range, format).
- The concept needs normalisation (lowercase email, trimmed string,
  uppercase code).
- The concept appears in multiple entities and should validate
  identically each time.
- The concept has methods beyond storage (e.g. `email.domain()`,
  `money.add(other)`).

If the concept is just `string` with no rules attached, leave it as
`string`. Value objects aren't a free win — every extra type costs
some reader attention.

## The minimum shape

```ts
// core/src/value_object/FooName.ts
import Result from "@efesto-cloud/result";
import InvalidFooNameError from "~/errors/InvalidFooNameError.js";

const MIN = 1;
const MAX = 80;

export default class FooName {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    static create(raw: string): Result<FooName, InvalidFooNameError> {
        if (typeof raw !== "string") {
            return Result.err(new InvalidFooNameError());
        }
        const trimmed = raw.trim();
        if (trimmed.length < MIN || trimmed.length > MAX) {
            return Result.err(new InvalidFooNameError());
        }
        return Result.ok(new FooName(trimmed));
    }

    toRaw(): string {
        return this.value;
    }

    equals(other: FooName): boolean {
        return this.value === other.value;
    }
}
```

The four rules embedded above:

1. **Private constructor.** Construction only happens through the
   factory. External code cannot bypass validation.
2. **`static create(raw): Result<T, Error>`** — the validated entry
   point. Returns `Result.err(...)` on invalid input, never throws.
3. **`toRaw()`** — returns the stored primitive so callers can
   serialise. Its inverse is `create()` (and, at the persistence
   boundary, the mapper's `from()`) — there is no VO `fromRaw()`.
4. **`readonly value`** — immutable.

## Validation patterns

- Type-check first (`typeof raw !== "string"` to defend against `null`
  / `undefined` / wrong types).
- Normalise next (`trim()`, `toLowerCase()`, `toUpperCase()`).
- Validate the normalised form.
- Return `Result.ok(new Foo(normalised))`.

For email:

```ts
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

static create(raw: string): Result<EmailAddress, InvalidEmailFormatError> {
    if (typeof raw !== "string") return Result.err(new InvalidEmailFormatError());
    const normalised = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalised)) return Result.err(new InvalidEmailFormatError());
    return Result.ok(new EmailAddress(normalised));
}
```

## Composite value object

When the VO holds more than one primitive:

```ts
export interface IMoney {
    amount: number;     // integer cents
    currency: string;   // ISO 4217
}

export default class Money {
    private readonly amount: number;
    private readonly currency: string;

    private constructor(amount: number, currency: string) {
        this.amount = amount;
        this.currency = currency;
    }

    static create(raw: IMoney): Result<Money, InvalidMoneyError> {
        if (!Number.isInteger(raw.amount)) return Result.err(new InvalidMoneyError());
        if (!/^[A-Z]{3}$/.test(raw.currency)) return Result.err(new InvalidMoneyError());
        return Result.ok(new Money(raw.amount, raw.currency));
    }

    toRaw(): IMoney { return { amount: this.amount, currency: this.currency }; }

    add(other: Money): Result<Money, CurrencyMismatchError> {
        if (this.currency !== other.currency) return Result.err(new CurrencyMismatchError());
        return Result.ok(new Money(this.amount + other.amount, this.currency));
    }
}
```

- `IMoney` is the raw interface. It also serves as the DTO shape for
  the entity if the VO is embedded.
- Operations return `Result<Money, Error>` because they can fail
  (currency mismatch, overflow).

## Sensitive VOs — passwords, secrets

Password VOs need a special property: `toRaw()` should not reveal the
plaintext, only the hash. The factory only accepts a hash, never a
plaintext:

```ts
export default class PasswordHash {
    private readonly hash: string;
    private constructor(hash: string) { this.hash = hash; }

    static fromHash(hash: string): PasswordHash {
        if (!hash) throw new Error("PasswordHash: hash is required");
        return new PasswordHash(hash);
    }

    toRaw(): string { return this.hash; }
}
```

Notice `fromHash` returns the VO directly (no `Result`) because the
caller has already produced a hash; the only failure mode is an empty
string, which is a programming bug. Hashing the plaintext is the
service layer's responsibility (`IPasswordHasher`); the VO is just the
typed wrapper around the stored hash.

## Nullable wrapping

A VO that may be absent has two reasonable patterns:

- **Have the entity hold `FooName | null`.** Build the VO only when
  the value exists. Most common.
- **Build a `Maybe<FooName>` at the value-object level.** Less common
  — only when the absence carries domain meaning that the entity wants
  to expose.

Don't make `create("")` return a "blank" VO. Either reject the empty
string or wrap with `null` at the call site.

## Equality

VOs are value-based, not reference-based. If the entity compares two
VOs for equality, add an `equals(other)` method:

```ts
equals(other: EmailAddress): boolean {
    return this.value === other.value;
}
```

For composites, compare every stored field.

## `toJSON()` vs `toRaw()`

- **`toRaw()`** — for use inside the entity's `toDTO()` and inside the
  mapper. Returns the primitive (or `IFoo` shape) so the surrounding
  serialisation knows what to do.
- **`toJSON()`** — only define if you want `JSON.stringify(vo)` to
  produce something specific (rare). Usually `toRaw()` is enough.

If you do define `toJSON()`, return the same thing `toRaw()` does:

```ts
toJSON(): IMoney { return this.toRaw(); }
```

## Cross-layer: VO inside the entity

The entity holds the VO as a typed prop:

```ts
type FooProps = {
    name: FooName;          // typed as the VO
    // ...
};
```

The entity's `create()` factory calls `VO.create()` first, propagates
the failure, and passes the VO into `new Foo(...)`:

```ts
static create(props: { name: string }, clock: IClock): Result<Foo, DomainError> {
    const name = FooName.create(props.name);
    if (name.isFailure()) return Result.err(name.error);
    // name.data is FooName
    return Result.ok(new Foo({ name: name.data, ... }));
}
```

The entity's `toDTO()` calls `.toRaw()`:

```ts
toDTO(): FooDto {
    return {
        // ...
        name: this.props.name.toRaw(),
    };
}
```

## Cross-layer: VO inside the mapper

At the persistence boundary the entity mapper rebuilds the VO from the
DB row. There is **no** value-object `fromRaw()` — the inverse of
`toRaw()` is the VO's own `create()` factory, which the mapper's
`from()` calls. Because the DB row should already contain valid data,
`from()` may throw if `create()` fails — that's a "corrupted state"
signal, not a domain error.

The mapper contract lives in `@efesto-cloud/entity`. Both interfaces
are type-only default exports re-exported as named types, with the same
**instance** methods `from(dto)` / `to(entity, options?)`:

- `IEntityMapper<E extends IEntity, RAW>` — entity ⇄ stored record.
  Lives in the persistence adapter package; see
  [persistence-adapter.md](persistence-adapter.md).
- `IValueObjectMapper<E extends object, RAW>` — for a standalone VO
  mapper when a VO needs its own raw conversion outside an entity.

```ts
import type { IEntityMapper } from "@efesto-cloud/entity";

class FooMapper implements IEntityMapper<Foo, FooRow> {
    from(row: FooRow): Foo {
        const name = FooName.create(row.name);
        if (name.isFailure()) {
            throw new Error(`Invalid name in DB for Foo ${row.id}: ${row.name}`);
        }
        return new Foo({ name: name.data, /* ... */ }, row.id);
    }

    to<P extends keyof FooRow = keyof FooRow>(
        foo: Foo,
        _options?: { pick?: P[] },
    ): Pick<FooRow, P> {
        return { id: foo._id, name: foo.name.toRaw(), /* ... */ } as Pick<FooRow, P>;
    }
}
```

`to()` doesn't need a Result — the entity is already valid by
construction, so `.toRaw()` always succeeds.

## Checklist — new VO

- [ ] File at `core/src/value_object/<Name>.ts`.
- [ ] `private constructor(...)`.
- [ ] `static create(raw): Result<T, Error>` validates and normalises.
- [ ] `toRaw(): primitive` (or raw-interface); inverse is `create()`
      (no `fromRaw()`).
- [ ] `equals(other)` if the VO appears in comparisons.
- [ ] Error class for invalid input declared in `core/src/errors/`.
- [ ] Re-exported from `core/src/value_object/index.ts`.

## "Seen in the wild"

- `packages/core/src/value_object/EmailAddress.ts` — regex + normalise.
- `packages/core/src/value_object/PasswordHash.ts` — sensitive-data
  pattern with `fromHash` instead of `create`.
