# @efesto-cloud/teardown

Register cleanup functions that run once on `SIGINT` / `SIGTERM` before the process exits.

## Installation

```bash
pnpm add @efesto-cloud/teardown
```

Requires Node ≥ 24.

## Quick Start

```ts
import TeardownUtil from "@efesto-cloud/teardown";

const teardown = new TeardownUtil();

// Register cleanups in the same order you set things up.
teardown
    .register(async () => {
        await db.close();
    })
    .register(async () => {
        await server.close();
    });
```

On `SIGINT` or `SIGTERM`:

1. Each registered function runs **sequentially**, in **last-in/first-out** order — the reverse of the order they were registered.
2. The process then exits with code `0`.
3. A second signal while shutdown is already in progress forces exit with code `1`.

## API

```ts
class TeardownUtil {
    constructor();
    register(fn?: () => Promise<void>): this;
}
```

- `register(fn)` — adds a cleanup function. Returns `this` so calls can be chained.
- Signal handlers are attached on construction — typically you want a single instance per process.

## Notes

- Failing cleanup functions (rejected promises) will bubble up and bypass later handlers. Wrap with `try/catch` inside each `fn` if you need best-effort shutdown.
- Registration order matters: cleanups run last-in/first-out, so register them in setup order (database first, HTTP server last) and they tear down in reverse (HTTP server first, database last).
- Only `SIGINT` and `SIGTERM` are handled. Uncaught exceptions or other signals do not trigger the handlers.
