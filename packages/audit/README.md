# @efesto-cloud/audit

Self-contained, extensible audit logging package for TypeScript use cases. Provides decorators, AsyncLocalStorage-based context propagation, and flexible actor/persistence patterns.

## Features

- 🎯 **Zero External Dependencies** - No DI framework required (Inversify-free)
- 🔄 **AsyncLocalStorage** - Automatic context propagation across async boundaries
- 🎭 **Generic Actor System** - Extensible actor types for any authentication model
- 💾 **Pluggable Persistence** - Bring your own storage (MongoDB, files, API, etc.)
- ⏱️ **Automatic Metrics** - Duration, success/failure tracking, error capture
- 🪝 **Lifecycle Hooks** - `onInput`/`onOutput` callbacks for custom data capture
- 🔒 **Type-Safe** - Full TypeScript support with generic types

## Installation

```bash
pnpm add @efesto-cloud/audit
```

**Peer Dependencies:**
- `@efesto-cloud/usecase`
- `@efesto-cloud/metadata`

## Quick Start

### 1. Define Your Actor Type

```typescript
import { IAuditActor } from "@efesto-cloud/audit";

// Define your domain-specific actor
type UserActor = IAuditActor<"USER"> & {
  payload: {
    id: string;
    email: string;
  };
};
```

### 2. Create a Persister

```typescript
import { AuditPersister } from "@efesto-cloud/audit";

const persister: AuditPersister<UserActor> = async (trace) => {
  await db.collection("audit_logs").insertOne(trace);
};
```

### 3. Decorate Your Use Case

```typescript
import { audit, AUDIT_VERBS } from "@efesto-cloud/audit";
import { IUseCase } from "@efesto-cloud/usecase";

interface CreatePostInput {
  userId: string;
  userEmail: string;
  title: string;
  content: string;
}

interface CreatePostOutput {
  postId: string;
}

@audit<CreatePostUseCase, UserActor>({
  entity: "Post",
  title: "Create New Post",
  verb: AUDIT_VERBS.CREATE,
  ttl: 86400 * 30, // 30 days
  onInput: (input, trace) => {
    // Set actor from input
    trace.setActor({
      type: "USER",
      payload: {
        id: input.userId,
        email: input.userEmail,
      },
    });
  },
  onOutput: (output, trace) => {
    // Set entity ID from output
    trace.setEntityId(output.postId);
  },
  persister,
})
class CreatePostUseCase implements IUseCase<CreatePostInput, CreatePostOutput> {
  async execute(input: CreatePostInput): Promise<CreatePostOutput> {
    // Your business logic here
    const postId = await createPost(input.title, input.content);
    return { postId };
  }
}
```

### 4. Access Audit Context Anywhere

```typescript
import { getAuditTrace } from "@efesto-cloud/audit";

async function createPost(title: string, content: string): Promise<string> {
  // Access audit trace deep in call stack
  const trace = getAuditTrace();
  if (trace) {
    trace.getMetadata().set("post_title_length", title.length.toString());
  }
  
  // ... your logic
  return "post-123";
}
```

## Core Concepts

### Audit Trace

The final audit trace object that gets persisted:

```typescript
interface AuditTrace<TActor extends IAuditActor> {
  _id: string;                    // Unique identifier
  actor: TActor | null;           // Who performed the action
  usecase: string;                // Use case name
  entity: string;                 // Entity type (e.g., "Post")
  entity_id: string | null;       // Specific entity ID
  timestamp: string;              // ISO 8601 timestamp
  expire_at: string | null;       // TTL expiration (MongoDB)
  metadata: IMetadata;            // Custom key-value data
  title: string;                  // Human-readable description
  verb: AuditVerb;               // Action verb (e.g., "CREATE")
}
```

### Actor System

Actors use discriminated unions for type safety:

```typescript
import { IAuditActor } from "@efesto-cloud/audit";

// Base interface
interface IAuditActor<TType extends string = string> {
  type: TType;
  payload: Record<string, unknown>;
}

// Your custom actors
type UserActor = IAuditActor<"USER"> & {
  payload: { id: string; email: string };
};

type SystemActor = IAuditActor<"SYSTEM"> & {
  payload: { service: string };
};

type ApiKeyActor = IAuditActor<"API_KEY"> & {
  payload: { keyId: string; scopes: string[] };
};

// Union for your application
type MyActor = UserActor | SystemActor | ApiKeyActor;
```

**Included Examples:**

The package includes reference implementations:

```typescript
import { 
  UserActor, 
  SystemActor, 
  ApiKeyActor,
  createUserActor,
  createSystemActor,
  createApiKeyActor
} from "@efesto-cloud/audit";

// Use helpers
const user = createUserActor("user-123", { email: "user@example.com" });
const system = createSystemActor("background-worker", { version: "1.0.0" });
const apiKey = createApiKeyActor("key-abc", { scopes: ["read", "write"] });
```

### Decorator Options

```typescript
interface AuditOptions<U, TActor> {
  // Required
  entity: string | { new(...args: any[]): any };  // Entity type or class
  title: string;                                   // Human-readable title
  verb: AuditVerb;                                // Action verb
  
  // Optional
  ttl?: number | Duration | "never";              // TTL in seconds or Duration
  onInput?: (input, trace) => void;               // Pre-execution hook
  onOutput?: (output, trace) => void;             // Post-execution hook
  persister?: AuditPersister<TActor>;             // Custom persister
  captureErrors?: boolean;                         // Auto-capture errors (default: true)
}
```

### Common Verbs

```typescript
import { AUDIT_VERBS } from "@efesto-cloud/audit";

AUDIT_VERBS.CREATE
AUDIT_VERBS.UPDATE
AUDIT_VERBS.DELETE
AUDIT_VERBS.ADD
AUDIT_VERBS.REMOVE
AUDIT_VERBS.LOGIN
AUDIT_VERBS.LOGOUT
AUDIT_VERBS.UPLOAD
AUDIT_VERBS.EXPORT
AUDIT_VERBS.IMPORT
AUDIT_VERBS.BATCH
AUDIT_VERBS.DOWNLOAD

// Or use custom strings
verb: "CUSTOM_ACTION"
```

### Metadata Keys

```typescript
import { AUDIT_METADATA_KEYS } from "@efesto-cloud/audit";

AUDIT_METADATA_KEYS.DURATION      // "duration_ms" (auto-set)
AUDIT_METADATA_KEYS.SUCCESS       // "success" (auto-set)
AUDIT_METADATA_KEYS.ERROR_NAME    // "error_name" (auto-set on failure)
AUDIT_METADATA_KEYS.ERROR_MESSAGE // "error_message" (auto-set on failure)

// Add your own
trace.getMetadata().set("custom_field", "value");
```

## Advanced Usage

### Custom Persister with MongoDB

```typescript
import { MongoClient } from "mongodb";
import { AuditPersister } from "@efesto-cloud/audit";

const client = new MongoClient(process.env.MONGO_URL);
const db = client.db("myapp");

const mongoPersister: AuditPersister = async (trace) => {
  await db.collection("audit_logs").insertOne(trace);
};
```

### File-Based Persister

```typescript
import { appendFile } from "fs/promises";
import { AuditPersister } from "@efesto-cloud/audit";

const filePersister: AuditPersister = async (trace) => {
  await appendFile(
    "audit.log",
    JSON.stringify(trace) + "\n",
    "utf-8"
  );
};
```

### Multi-Backend Persister

```typescript
const multiPersister: AuditPersister = async (trace) => {
  await Promise.all([
    db.collection("audit_logs").insertOne(trace),
    logService.send(trace),
    eventBus.publish("audit.trace", trace),
  ]);
};
```

### TTL Configuration

```typescript
import { Duration } from "luxon";

@audit({
  // Numeric seconds
  ttl: 86400 * 30,  // 30 days
  
  // Or Duration object
  ttl: Duration.fromObject({ days: 30 }),
  
  // Or never expire
  ttl: "never",
  
  // ... other options
})
```

### Dynamic Metadata

```typescript
@audit({
  onInput: (input, trace) => {
    // Add custom metadata
    trace.getMetadata()
      .set("ip_address", input.clientIp)
      .set("user_agent", input.userAgent)
      .set("request_id", input.requestId);
  },
  onOutput: (output, trace) => {
    trace.getMetadata()
      .set("items_created", output.count.toString())
      .set("total_size_bytes", output.sizeBytes.toString());
  },
})
```

### Accessing Trace in Nested Functions

```typescript
import { getAuditTrace } from "@efesto-cloud/audit";

async function someDeepFunction() {
  const trace = getAuditTrace();
  
  if (trace) {
    // Add context from anywhere in the call stack
    trace.getMetadata().set("database_query_count", "5");
    trace.getMetadata().set("cache_hit", "true");
  }
}
```

### Manual Trace Building

```typescript
import { AuditTraceBuilder, runWithAuditTrace } from "@efesto-cloud/audit";

const builder = new AuditTraceBuilder<UserActor>();

const result = await runWithAuditTrace(builder, async () => {
  builder
    .setUsecase("ManualOperation")
    .setEntity("Resource")
    .setTitle("Manual Audit")
    .setVerb("UPDATE")
    .setActor({
      type: "USER",
      payload: { id: "user-123", email: "user@example.com" },
    });
  
  // Your logic here
  await doWork();
  
  const trace = builder.build();
  await persister(trace);
});
```

### Error Handling

```typescript
@audit({
  captureErrors: true,  // Default: captures error name/message
  // ... other options
})
```

When `captureErrors: true` (default), the decorator automatically adds:
- `error_name` - Error class name
- `error_message` - Error message

To disable: `captureErrors: false`

## API Reference

### Exports

```typescript
// Decorator
export function audit<U, TActor>(options: AuditOptions<U, TActor>): ClassDecorator;

// Builder
export class AuditTraceBuilder<TActor>;

// Context utilities
export function getAuditTrace<TActor>(): AuditTraceBuilder<TActor> | null;
export function runWithAuditTrace<TActor, R>(builder: AuditTraceBuilder<TActor>, fn: () => R): R;

// Types
export type IAuditActor<TType extends string>;
export type AuditTrace<TActor>;
export type AuditVerb;
export type AuditOptions<U, TActor>;
export type AuditPersister<TActor>;

// Constants
export const AUDIT_VERBS;
export const AUDIT_METADATA_KEYS;

// Error
export class AuditTraceValidationError extends Error;

// Example actors
export type UserActor;
export type SystemActor;
export type ApiKeyActor;
export function createUserActor(...);
export function createSystemActor(...);
export function createApiKeyActor(...);
```

## Migration from Old Version

If you're migrating from the Inversify-based version:

### Before (Old)

```typescript
import audit from "@efesto-cloud/audit";

@audit({
  entity: "Post",
  title: "Create Post",
  verb: IAuditLog.Verb.CREATE,
  onInput: (input, context) => {
    context.setOperator(input.operator);  // Hardcoded method
  },
})
class CreatePostUseCase {
  @inject(Symbols.Service.AuditContext)
  private auditContext!: IAuditContext;  // DI injection
  
  async execute(input) { /* ... */ }
}
```

### After (New)

```typescript
import { audit, AUDIT_VERBS } from "@efesto-cloud/audit";

@audit<CreatePostUseCase, UserActor>({
  entity: "Post",
  title: "Create Post",
  verb: AUDIT_VERBS.CREATE,
  onInput: (input, trace) => {
    trace.setActor({  // Generic method
      type: "USER",
      payload: { id: input.userId, email: input.email },
    });
  },
  persister: mongoPersister,  // Explicit persister
})
class CreatePostUseCase {
  // No DI needed!
  async execute(input) { /* ... */ }
}
```

**Key Changes:**
1. ❌ No more `@inject` decorators
2. ❌ No more `setOperator`/`setImpresa` - use generic `setActor`
3. ✅ Add `persister` in options
4. ✅ Define your own actor types
5. ✅ Use `getAuditTrace()` instead of injected context

## License

MIT
