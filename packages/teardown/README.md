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

teardown
    .register(async () => {
        await server.close();
    })
    .register(async () => {
        await db.close();
    });
```

On `SIGINT` or `SIGTERM`:

1. Each registered function runs **sequentially**, in the order they were registered.
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
- Registration order matters: close things in the reverse order you opened them (HTTP server first, database last, etc.).
- Only `SIGINT` and `SIGTERM` are handled. Uncaught exceptions or other signals do not trigger the handlers.
