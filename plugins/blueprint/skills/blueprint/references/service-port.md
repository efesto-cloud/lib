# Service port

Non-repo dependencies a use case needs: clocks, hashers, codecs,
calendar feeds, authenticators, mailers, external APIs. Lives in
`core/src/service/`.

This is the most under-documented layer in the codebase — `usecase.md`
says "inject services like repos" but doesn't explain how to design
one or where it lives.

## Three flavours, three locations

The interface always lives in `core/src/service/`. The implementation
lives in one of three places depending on what it does:

| Flavour | Examples | Port location | Impl location | Bound by |
|---------|----------|---------------|---------------|----------|
| **Pure / deterministic** | `IClock`, `IExcelCodec`, `ICalendarFeedService` | `core/src/service/` | `core/src/service/impl/` | `ServicesModule.ts` |
| **Impure but core-shippable** | `IPasswordHasher` (needs `node:crypto`) | `core/src/service/` | `core/src/service/impl/` | `installServices()` |
| **I/O bound** | `IEmailSender`, `IS3Client`, `IExternalApiClient` | `core/src/service/` | adapter package (`@*/email`, `@*/s3`, …) | adapter's `install.ts` |

The boundary between "pure" and "impure but core-shippable" matters
because `ServicesModule` is auto-loaded inside `initContainer()` while
`installServices()` has to be opted-into by the webapp. If the impl
accidentally imports `node:crypto` and the webapp runs in an
environment without it (a CDN edge worker), the auto-loaded module
crashes at boot. Splitting the two installers is the safety net.

## The minimum interface

```ts
// core/src/service/IClock.ts
import type { DateTime } from "luxon";

export default interface IClock {
    now(): DateTime;
}
```

Rules:

- **Method names describe intent**, not implementation. `now()`, not
  `getCurrentTime()`.
- **Return types use domain shapes** (`DateTime`, `Maybe<Foo>`,
  `Result<T, E>`) — never `Date`, never `string` if the domain
  treats it as a richer type.
- **No constructors in the interface.** Constructor-injection
  happens at the impl side.

Bigger example:

```ts
// core/src/service/IPasswordHasher.ts
export default interface IPasswordHasher {
    hash(plaintext: string): Promise<string>;
    verify(plaintext: string, hash: string): Promise<boolean>;
}
```

- `hash` returns a `Promise<string>` because the impl may run async
  (scrypt with high cost factor).
- `verify` returns `Promise<boolean>` — a simple yes/no. A failure to
  verify isn't a domain error; it's a "wrong password" answer that
  the use case turns into an `InvalidCredentialsError` if it wants
  to.

## When a service returns Result / Maybe

- **`Result<T, E>`** when the operation has a well-defined failure
  the use case must handle (e.g.
  `IMemberAuthenticator.authenticateWithPassword` returns
  `Result<MemberDto, InvalidCredentialsError>`).
- **`Maybe<T>`** when the answer is an optional value with domain
  meaning (e.g. `ISessionService.findActive(token)` returns
  `Maybe<SessionDto>`).
- **Plain `Promise<T>` or `Promise<T | null>`** when the
  operation is unambiguous. `IClock.now()` returns `DateTime`. A repo-
  like lookup returns `T | null`.

The same `Maybe` vs `null` rule from the repo port applies: prefer
`null` when the absence is just "not found"; prefer `Maybe` when the
absence is a recognised domain state worth modelling.

## Implementation — pure case

```ts
// core/src/service/impl/LuxonClock.ts
import { injectable } from "inversify";
import { DateTime } from "luxon";
import type IClock from "~/service/IClock.js";

@injectable()
export default class LuxonClock implements IClock {
    now(): DateTime {
        return DateTime.now();
    }
}
```

Bound in `core/src/service/ServicesModule.ts`:

```ts
const ServicesModule = new ContainerModule((bind) => {
    bind<IClock>(InternalSymbols.Service.Clock)
        .to(LuxonClock)
        .inSingletonScope();
    // ...
});
```

Loaded automatically by `initContainer()` (see `composition-root.md`).

## Implementation — impure but core-shippable

Impl still lives in core, but is bound by `installServices()` so the
webapp explicitly opts in:

```ts
// core/src/service/impl/ScryptPasswordHasher.ts
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { injectable } from "inversify";
import type IPasswordHasher from "~/service/IPasswordHasher.js";

@injectable()
export default class ScryptPasswordHasher implements IPasswordHasher {
    async hash(plaintext: string): Promise<string> {
        // ... scrypt with random salt ...
    }
    async verify(plaintext: string, hash: string): Promise<boolean> {
        // ... timing-safe comparison ...
    }
}
```

Bound in `core/src/service/impl/installServices.ts`:

```ts
export default function installServices(): ContainerModule {
    return new ContainerModule((bind) => {
        bind(InternalSymbols.Service.Clock).to(LuxonClock);
        bind(InternalSymbols.Service.PasswordHasher).to(ScryptPasswordHasher);
    });
}
```

The webapp's composition root calls `installServices()` explicitly.

## Implementation — I/O bound

A new adapter package. Let's say `IEmailSender`:

1. **Port in core**:

```ts
// core/src/service/IEmailSender.ts
export interface SendEmailInput {
    to: string;
    subject: string;
    body_html: string;
}

export default interface IEmailSender {
    send(input: SendEmailInput): Promise<Result<void, EmailSendFailedError>>;
}
```

2. **Symbol in core**:

```ts
// core/src/di/InternalSymbols.ts
Service: {
    // ...
    EmailSender: Symbol.for("Service.EmailSender"),
}
```

3. **Adapter package**: `@*/email` (or whatever). Implementation:

```ts
// email/src/ResendEmailSender.ts
import Result from "@efesto-cloud/result";
import { type IEmailSender, EmailSendFailedError } from "@*/core";
import { inject, injectable } from "inversify";

@injectable()
export default class ResendEmailSender implements IEmailSender {
    constructor(/* @inject(...) the Resend API key */) {}
    async send(input): Promise<Result<void, EmailSendFailedError>> {
        // ... POST to Resend API ...
    }
}
```

4. **Adapter's installer**:

```ts
// email/src/install.ts
export default function install(opts: { apiKey: string }) {
    return new ContainerModule((bind) => {
        bind(InternalSymbols.Service.EmailSender)
            .to(ResendEmailSender)
            .inSingletonScope();
    });
}
```

5. **Composition root** in the webapp:

```ts
container.load(
    installServices(),
    useMock ? installStub() : installPrisma({ DB: env.DB }),
    installEmail({ apiKey: env.RESEND_API_KEY }),
);
```

Now any use case can inject `IEmailSender` and it works in production
(Resend) without core knowing anything about Resend.

## Stubs and tests

For tests and the mock environment, write a stub impl in `@*/stub`
that satisfies the same interface:

```ts
// stub/src/InMemoryEmailSender.ts
@injectable()
export default class InMemoryEmailSender implements IEmailSender {
    readonly sent: SendEmailInput[] = [];
    async send(input): Promise<Result<void, EmailSendFailedError>> {
        this.sent.push(input);
        return Result.ok(undefined);
    }
}
```

The stub installer binds it under the same symbol:

```ts
bind(InternalSymbols.Service.EmailSender)
    .to(InMemoryEmailSender)
    .inSingletonScope();
```

In tests, get the stub from the container and inspect `.sent` after
the use case ran.

## Service injection in a use case

```ts
@injectable()
export default class CreateMemberUseCase implements ICreateMemberUseCase {
    constructor(
        @inject(InternalSymbols.Repo.Member)
        private readonly memberRepo: IMemberRepository,
        @inject(InternalSymbols.Service.PasswordHasher)
        private readonly passwordHasher: IPasswordHasher,
        @inject(InternalSymbols.Service.Clock)
        private readonly clock: IClock,
    ) {}

    async execute(input): Promise<Result<MemberDto, DomainError>> {
        const passwordHash = await this.passwordHasher.hash(input.password);
        const created = Member.create(
            { ..., password_hash: passwordHash },
            this.clock,
        );
        // ...
    }
}
```

The service is just another constructor dep, named with a `@inject(...)`
symbol. The use case body uses it without any further wiring.

## Domain services vs application services

Two distinctions sometimes drawn in DDD literature:

- **Application service** — orchestrates infrastructure (mailer, clock,
  hash). Most services in this codebase are these.
- **Domain service** — pure domain logic that doesn't fit on a single
  entity (cross-entity rules, policies). E.g. a tax-calculation
  service that needs `Order` and `CustomerProfile`.

The codebase has a `DomainService` symbol bucket in
`InternalSymbols.ts` reserved for the latter; in `task-planning` it's
currently empty. When you do add one, follow the same pattern: port
in `core/src/service/`, impl in `core/src/service/impl/` (domain
services are pure by definition), bind in `ServicesModule.ts`.

## Cross-layer interactions

- **Use case ← service**: constructor-injected via
  `@inject(InternalSymbols.Service.X)`. Calls the service method
  inside `execute(...)`.
- **Service ← infrastructure**: an I/O service's impl can itself
  inject configuration (an API key, an HTTP client). Those bindings
  happen inside the adapter's `install.ts`.
- **Service ↔ entity**: most services don't import entities; they
  work on DTOs or primitives. `IClock` returns a `DateTime`, not an
  entity. `IPasswordHasher` takes a `string`, not a `Member`.
- **Authenticator services** are the exception — they return DTOs:
  `IMemberAuthenticator.authenticateWithPassword(email, password)
  -> Result<MemberDto, InvalidCredentialsError>`. The actor flows
  back to the loader, which passes it into the use case.

## Choosing the right name

- **Capability verbs**: `IClock` not `IClockService` (the noun is
  enough).
- **`I<Capability>er`** for actor-like names: `IPasswordHasher`,
  `IEmailSender`, `ITokenGenerator`.
- **`I<Capability>Service`** when the name needs to disambiguate
  from a similarly-named entity or VO: `ICalendarFeedService` (a
  `CalendarFeed` value object also exists in some projects).

Consistency inside one codebase matters more than which convention
you pick.

## Checklist — new service port

- [ ] Port file `core/src/service/I<Capability>.ts`.
- [ ] Methods describe intent; return types use domain shapes.
- [ ] Decided: pure / impure-core-shippable / I/O-bound.
- [ ] Symbol added to `InternalSymbols.Service.<Capability>`.
- [ ] Impl created in the matching location.
- [ ] `@injectable()` on the impl.
- [ ] Binding added to the matching `ContainerModule`
      (`ServicesModule.ts`, `installServices()`, or adapter's
      `install.ts`).
- [ ] If introducing a new adapter package: webapp's composition root
      updated to load the new installer.
- [ ] If I/O-bound: a stub impl exists for the mock / test environment.
- [ ] Use case consumes via `@inject(InternalSymbols.Service.X)`.

## "Seen in the wild"

- `packages/core/src/service/IClock.ts` +
  `packages/core/src/service/impl/LuxonClock.ts` — pure case.
- `packages/core/src/service/IPasswordHasher.ts` +
  `packages/core/src/service/impl/ScryptPasswordHasher.ts` +
  `packages/core/src/service/impl/installServices.ts` — impure-core-
  shippable case.
- `packages/core/src/service/IMemberAuthenticator.ts` +
  `packages/core/src/service/impl/MemberAuthenticator.ts` —
  Result-returning service used by the webapp loader.
- `packages/core/src/service/ICalendarFeedService.ts` +
  `packages/core/src/service/impl/IcsCalendarFeedService.ts` —
  codec-style service producing serialised output.
- `packages/core/src/excel/IExcelCodec.ts` +
  `packages/core/src/excel/impl/ExcelJsCodec.ts` — codec-style
  service that happens to live in its own folder; the principle is
  the same.
