# Package Dependency Matrix

Exact `@efesto-cloud/*` and other peer-dep versions to pin in each package's `package.json`. 

## Root `package.json`

```json
{
    "devDependencies": {
        "@biomejs/biome": "^2.4.4",
        "rimraf": "^6.0.1"
    }
}
```

## `packages/core/package.json` — peerDependencies

```json
{
    "@efesto-cloud/database-context": "^0",
    "@efesto-cloud/entity": "^0",
    "@efesto-cloud/env": "^0",
    "@efesto-cloud/maybe": "^0",
    "@efesto-cloud/metadata": "^0",
    "@efesto-cloud/mongodb-population": "^0",
    "@efesto-cloud/population": "^0",
    "@efesto-cloud/result": "^0",
    "decimal.js": "^10.5.0",
    "inversify": "^6.0.2",
    "luxon": "^3.5.0",
    "phone": "^3.1.50",
    "typeid-js": "^1.2.0",
    "winston": "^3.14.2",
    "zod": "^4"
}
```

devDependencies:

```json
{
    "@types/luxon": "^3",
    "@types/node": "^24",
    "rimraf": "^6.0.1",
    "tsc-alias": "^1.8.16",
    "typescript": "^6"
}
```

## `packages/mongodb/package.json` — peerDependencies

```json
{
    "{{ns}}/core": "workspace:*",
    "@efesto-cloud/entity": "^0.0.4",
    "@efesto-cloud/env": "^0.0.4",
    "@efesto-cloud/maybe": "^0.0.4",
    "@efesto-cloud/metadata": "^0.0.4",
    "@efesto-cloud/mongodb-database-context": "^0.0.4",
    "@efesto-cloud/mongodb-population": "^0.0.4",
    "@efesto-cloud/population": "^0.0.4",
    "@efesto-cloud/result": "^0.0.4",
    "inversify": "^6",
    "luxon": "^3",
    "mongodb": "^7",
    "typeid-js": "^1.2.0"
}
```

devDependencies:

```json
{
    "@types/luxon": "^3",
    "@types/node": "^24",
    "typescript": "^6"
}
```

## `packages/webapp/package.json` — dependencies (not peers — real deps for Vite build)

```json
{
    "@dotenvx/dotenvx": "^1.35.0",
    "@efesto-cloud/env": "^0.0.4",
    "@efesto-cloud/maybe": "^0.0.4",
    "@efesto-cloud/toast": "^0.0.4",
    "{{ns}}/core": "workspace:*",
    "@react-router/express": "^7.9.1",
    "@react-router/node": "^7.9.1",
    "compression": "^1.8.1",
    "decimal.js": "^10.6.0",
    "express": "^5.1.0",
    "isbot": "^5.1.27",
    "lucide-react": "^0.544.0",
    "luxon": "^3.7.2",
    "morgan": "^1.10",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-hot-toast": "^2.6.0",
    "react-router": "^7.9.1",
    "react-select": "^5.10.2",
    "reflect-metadata": "^0.2.2",
    "source-map-support": "^0.5.21",
    "zod": "^4.1.9"
}
```

Conditional: add `"{{ns}}/mongodb": "workspace:*"` if `has_mongodb`.

devDependencies (webapp):

```json
{
    "@csstools/postcss-oklab-function": "^4.0.9",
    "@react-router/dev": "^7.9.1",
    "@react-router/fs-routes": "^7.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/compression": "^1.8.1",
    "@types/express": "^5.0.3",
    "@types/express-serve-static-core": "^5.0.7",
    "@types/luxon": "^3.7.1",
    "@types/morgan": "^1.9.10",
    "@types/node": "^22",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "autoprefixer": "^10.4.21",
    "daisyui": "^5.1.13",
    "postcss": "^8.5.6",
    "sass-embedded": "^1.93.0",
    "tailwindcss": "^4",
    "typescript": "^5.9.2",
    "vite": "^7.1.6",
    "vite-tsconfig-paths": "^5.1.4"
}
```

If `ui_stack == "tailwind-only"`: remove `daisyui`, `@csstools/postcss-oklab-function`.
If `ui_stack == "plain-css"`: remove `daisyui`, `tailwindcss`, `@tailwindcss/postcss`, `autoprefixer`, `postcss`, `@csstools/postcss-oklab-function`. Keep `sass-embedded` only if user wants SCSS.

## Engines

All packages (where scripts are relevant):

```json
{
    "engines": {
        "node": ">=22.12.0"
    }
}
```

## Node version in devcontainer

Use `mcr.microsoft.com/devcontainers/typescript-node:24-trixie`.

## Mongo version in devcontainer

`mongo:8` with single-node replica set (`--replSet rs0`) on port 27017.
