# Composition root

Where the container actually comes alive. Lives in the webapp, not in
core — only the webapp knows which adapter to load and what
environment it runs in.

## The two files

The composition root is two files in `@*/webapp/`:

```
webapp/
├── app/
│   └── container.server.ts     — bootContainer + getResolveUseCase
└── workers/
    └── app.ts                  — Cloudflare Worker entry; augments
                                  AppLoadContext with resolveUseCase
```

In a different runtime (Node + Express, Bun + Hono, …) the file layout
changes but the responsibilities don't: one file boots the container,
one file plugs the typed resolver into the request handler's context.

## `container.server.ts` — the boot sequence

The composition root imports **one** active persistence adapter plus the
`@*/stub` in-memory adapter, and picks between them at runtime. The
active adapter is whichever the project chose — its installer is
generically `installPersistence`, concretely `installPrisma` /
`installMongo` / `installDrizzle`. Core never sees which one.

```ts
// webapp/app/container.server.ts
import {
    container,
    createUseCaseResolver,
    initContainer,
    installServices,
    type UseCaseResolver,
} from "@task-management/core";
// The active adapter. Swap this one import to switch databases —
// e.g. @task-management/mongodb-adapter exporting installMongo.
import installPersistence from "@task-management/prisma-adapter/install";
import installStub, { seed as seedStub } from "@task-management/stub";

let booted = false;

async function bootContainer(env: CloudflareEnvironment): Promise<void> {
    if (booted) return;

    // 1. Load core's own modules (use cases + pure services).
    await initContainer();

    // 2. Decide which adapter to load.
    const useMock = env.NODE_ENV === "mock";

    // 3. Load the chosen adapter + impure services.
    container.load(
        installServices(),
        useMock ? installStub() : installPersistence({ DB: env.DB }),
    );

    // 4. Optionally seed the stub.
    if (useMock) {
        await seedStub(container);
    }

    booted = true;
}

export async function getResolveUseCase(
    env: CloudflareEnvironment,
): Promise<UseCaseResolver> {
    await bootContainer(env);
    return createUseCaseResolver(container);
}
```

What's going on, step by step:

1. **`initContainer()`** (defined in `core/src/di/container.ts`) loads
   the per-domain `<Domain>Module.ts` modules and the
   `ServicesModule` (which binds pure services like `IExcelCodec`,
   `IMemberAuthenticator`, `ICalendarFeedService`). After this call,
   the container knows about every use case symbol and every
   pure-service symbol — but no repos and no impure services.
2. **`useMock = env.NODE_ENV === "mock"`** — the environment-switch.
   `NODE_ENV` here is your Cloudflare env binding. In Node-based apps
   it'd be `process.env.NODE_ENV` or a CLI flag.
3. **`container.load(installServices(), installPersistence(...))`** —
   second load wave:
   - `installServices()` (from `core/src/service/impl/installServices.ts`)
     binds impure services that core can't ship by default (e.g.
     `ScryptPasswordHasher` needs Node's `crypto`, which would crash
     a non-Node runtime if it were auto-loaded). The webapp opts in.
   - `installPersistence({ DB: env.DB })` (from the active adapter's
     `src/install.ts`) binds the DB client/connection (driver-specific,
     package-private), binds the unit-of-work implementation to
     `InternalSymbols.UnitOfWork` — `@efesto-cloud/prisma-unit-of-work`
     for Prisma, `@efesto-cloud/mongodb-unit-of-work` for MongoDB — and
     binds every `<Entity>RepoImpl` to `InternalSymbols.Repo.<Entity>`.
     See `references/persistence-adapter.md`.
   - `installStub()` (from `stub/src/install.ts`) is the same shape
     with in-memory implementations.
4. **`seedStub(container)`** is only relevant for the mock path —
   pre-loads fixtures into the in-memory repos so a developer's mock
   preview has data.
5. **`createUseCaseResolver(container)`** (from `core/src/di/resolveUseCase.ts`)
   wraps `container.get(...)` in a typed function.

The `booted` flag matters because Cloudflare Workers reuse the global
scope across requests in the same isolate. Without the guard, every
request would re-load the modules, accumulating bindings and leaking
memory.

## `workers/app.ts` — augmenting the request context

```ts
// webapp/workers/app.ts
import "reflect-metadata";
import type { UseCaseResolver } from "@task-management/core";
import { createRequestHandler } from "react-router";
import { getResolveUseCase } from "~/container.server.js";

declare global {
    interface CloudflareEnvironment extends Env {}
}

declare module "react-router" {
    export interface AppLoadContext {
        cloudflare: { env: CloudflareEnvironment; ctx: ExecutionContext };
        resolveUseCase: UseCaseResolver;
    }
}

const requestHandler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE,
);

export default {
    async fetch(request, env, ctx) {
        const resolveUseCase = await getResolveUseCase(env);
        return requestHandler(request, {
            cloudflare: { env, ctx },
            resolveUseCase,
        });
    },
} satisfies ExportedHandler<CloudflareEnvironment>;
```

Three things to notice:

- **`import "reflect-metadata"`** at the top — Inversify needs it.
  Importing once at the entry point is enough; the rest of the code
  doesn't have to repeat it.
- **`declare module "react-router"`** — extends the
  `AppLoadContext` interface with `resolveUseCase`. After this
  augmentation, every loader and action in the app sees
  `context.resolveUseCase` with its full typed signature.
- **`getResolveUseCase(env)` per request** — the call is fast
  (`booted` short-circuits) but the function itself is async because
  `initContainer()` is. The resolver is built on every request even
  if the container itself is reused.

## Calling a use case from a loader

```tsx
// webapp/app/routes/members/$id.tsx (or .ts)
import type { Route } from "./+types/$id.js";

export async function loader({ params, context }: Route.LoaderArgs) {
    const useCase = context.resolveUseCase("members.GetMember");
    const result = await useCase.execute({ member_id: params.id });

    if (result.isFailure()) {
        throw new Response(null, { status: 404 });
    }
    return { member: result.data };
}
```

- The string `"members.GetMember"` is statically typed against
  `keyof UseCaseRegistry`. Typos fail at compile time.
- The return type of `execute(...)` is inferred from the registry —
  `Promise<Result<MemberDto, DomainError>>` in this case.
- The loader handles `Result.isFailure()` and translates to an HTTP
  response. The use case stays pure.

For actions (POST/PUT/DELETE/etc.):

```tsx
export async function action({ request, context }: Route.ActionArgs) {
    const formData = await request.formData();
    const actor = await requireMember(request, context.cloudflare.env);

    const useCase = context.resolveUseCase("members.UpdateMemberProfile");
    const result = await useCase.execute({
        member_id: formData.get("member_id") as string,
        name: formData.get("name") as string ?? undefined,
        code: formData.get("code") as string ?? undefined,
        actor,
    });

    if (result.isFailure()) {
        // map domain error → form-friendly response
    }
    return { member: result.data };
}
```

`requireMember(request, env)` is the loader-side authentication
helper — it reads the session cookie, asks `IMemberAuthenticator`
(via `container.get(InternalSymbols.Service.MemberAuthenticator)` or
its own resolver) to resolve it to a `MemberDto`, and throws a 401
response if absent. The actor object then enters the use case as
plain input; the use case never re-verifies.

## Adding (or switching to) another adapter package

Suppose you're adding `@*/mongodb-adapter` as an alternative to
`@*/prisma-adapter`.

1. **In the new package**: write `install({ ... })` returning a
   `ContainerModule` that binds the same `InternalSymbols.Repo.*` and
   `InternalSymbols.UnitOfWork` keys to your MongoDB impls (the
   unit-of-work bound to `@efesto-cloud/mongodb-unit-of-work`).
2. **In `container.server.ts`**: to *switch* databases, change the single
   `installPersistence` import to the new adapter. To *run several side by
   side*, add a branch in the environment switch:
   ```ts
   container.load(
       installServices(),
       env.NODE_ENV === "mock"        ? installStub() :
       env.PERSISTENCE === "mongodb"  ? installMongo({ uri: env.MONGO_URI }) :
       installPrisma({ DB: env.DB }),
   );
   ```
3. **In `package.json`**: add the new package as a dependency of the
   webapp. Nothing else changes — core, every use case, every route
   continue to work without modification.

That's the payoff of the hexagon: swappable adapters with a one-line
change in the composition root.

## Adding a service that the webapp itself needs

Sometimes the webapp wants to inject a service it built (analytics,
metrics, logging adapter) into use cases at composition time.

1. Declare the port in `core/src/service/I<Capability>.ts`.
2. Add the symbol to `InternalSymbols.Service.*`.
3. Build the impl inside the webapp (say,
   `app/services/CloudflareAnalytics.ts`).
4. Register it in `bootContainer()`:
   ```ts
   container.bind<IAnalytics>(InternalSymbols.Service.Analytics)
       .to(CloudflareAnalytics)
       .inSingletonScope();
   ```

The use case in core remains adapter-agnostic; the binding only happens
in the composition root.

## "Seen in the wild"

- `packages/webapp/app/container.server.ts`
- `packages/webapp/workers/app.ts`
- Example loader using `context.resolveUseCase(...)`:
  `packages/webapp/app/routes/members/...tsx` (and siblings)
- Auth helper: `packages/webapp/app/auth.server.ts`
- Worker types: the project has a generated `worker-configuration.d.ts`
  for the `Env` interface.
