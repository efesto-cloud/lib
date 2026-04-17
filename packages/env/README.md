# @efesto-cloud/env

Typed, cached accessors for `process.env` — with both throwing (`string`, `integer`, …) and safe (`stringSafe`, `integerSafe`, …) variants that return a `Result`.

## Installation

```bash
pnpm add @efesto-cloud/env @efesto-cloud/result
```

## Quick Start

```ts
import EnvKey from "@efesto-cloud/env";

// Throws ExpectedValueEnvKeyError if missing
const url = EnvKey.string("DATABASE_URL");
const port = EnvKey.integer("PORT");
const debug = EnvKey.boolean("DEBUG");

// Safe variants return Result<T, E>
const res = EnvKey.integerSafe("PORT");
if (res.isFailure()) {
    console.error(res.error);
} else {
    console.log(res.data);
}
```

## API

Throwing accessors (unwrap the safe version):

```ts
EnvKey.string(key): string
EnvKey.integer(key): number
EnvKey.float(key): number
EnvKey.bigInt(key): bigint
EnvKey.boolean(key): boolean
EnvKey.file(key): string            // reads the file at the path
EnvKey.something(key, parse): T     // custom parser
```

Safe accessors — each returns `Result<T, ExpectedValueEnvKeyError | Expected<…>Error>`:

```ts
EnvKey.stringSafe(key)
EnvKey.integerSafe(key)
EnvKey.floatSafe(key)
EnvKey.bigIntSafe(key)
EnvKey.booleanSafe(key)
EnvKey.fileSafe(key)
EnvKey.somethingSafe(key, (str) => Result<T, E>)
```

### Booleans

Truthy: `true`, `1`, `yes`, `y`, `si`, `s`, `on`, `enabled`, `ok`.
Falsy: `false`, `0`, `no`, `n`, `off`, `disabled`, `ko`.

### Files

`file` / `fileSafe` read the file at the path in the env var (common pattern for Docker secrets and K8s mounted files) and return its trimmed contents.

### Typed keys

Keys are constrained to the ones declared on `NodeJS.ProcessEnv`. Augment it in a project-local `.d.ts` to unlock autocomplete:

```ts
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DATABASE_URL: string;
            PORT: string;
            DEBUG?: string;
        }
    }
}
```

## Caching

Resolved string values are cached per key on first read. Subsequent reads skip `process.env` lookup.

## Errors

All safe methods return typed error instances exported from `@efesto-cloud/env/errors/*`:

- `ExpectedValueEnvKeyError` — key is missing
- `ExpectedIntegerEnvVarError` / `ExpectedFloatEnvVarError` / `ExpectedBigIntEnvVarError`
- `ExpectedBooleanEnvVarError`
- `ExpectedFileEnvVarError` — path doesn't exist
