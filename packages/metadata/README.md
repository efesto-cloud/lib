# @efesto-cloud/metadata

A tiny, typed string-to-string key/value store. Useful for carrying structured-but-flexible metadata alongside domain objects (audit logs, context, telemetry…).

## Installation

```bash
pnpm add @efesto-cloud/metadata
```

## Quick Start

```ts
import Metadata from "@efesto-cloud/metadata";

const m = Metadata.create<"ip" | "user_agent">();

m.set("ip", "127.0.0.1")
 .set("user_agent", "Mozilla/5.0");

m.get("ip");        // "127.0.0.1"
m.has("user_agent"); // true
m.entries();         // [["ip", "127.0.0.1"], ["user_agent", "Mozilla/5.0"]]
m.toDTO();           // { ip: "127.0.0.1", user_agent: "Mozilla/5.0" }
```

## API

```ts
class Metadata<K extends string = string> {
    set(key: K, value: string): this;
    get(key: K): string | undefined;
    remove(key: K): this;
    has(key: K): boolean;
    add(...entries: [K, string][]): void;
    entries(): [K, string][];
    toDTO(): IMetadata<K>;

    static create<K extends string>(obj?: IMetadata<K>): Metadata<K>;
    static fromEntries<K extends string>(entries: [K, string][]): Metadata<K>;
}

type IMetadata<K extends string = string> = { [key in K]?: string };
```

## Notes

- Values are always `string`. Serialize numbers/booleans at the call site (`value.toString()`).
- The optional `K` generic narrows the allowed keys — use it to lock metadata to a fixed vocabulary:

```ts
type AuditKeys = "duration_ms" | "success" | "error_name";
const trace = Metadata.create<AuditKeys>();
trace.set("duration_ms", "42"); // ok
trace.set("other", "x");        // ✗ type error
```
