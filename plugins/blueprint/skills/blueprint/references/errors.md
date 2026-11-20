# Errors

```ts
// contract/src/errors/ExpenseNotFoundError.ts
import { TaggedError } from "better-result";
export default class ExpenseNotFoundError extends TaggedError("ExpenseNotFoundError") {}

// core/src/errors/ReceiptStorageError.ts
export default class ReceiptStorageError extends TaggedError("ReceiptStorageError")<{
    cause?: unknown;
}> {}
```

## Form

- Native better-result: `TaggedError("<Name>Error")<{ fields }>`, tag equal to
  the class name. No helper, no schema, no codec.
- Fields only when they make a message more precise; a cause goes in
  `cause?: unknown`. An `<Entity>NotFoundError` has no fields.
- One file per error, `export default`.

## Where

| Place | Which error |
|---|---|
| `contract/src/errors/` | it appears in some use case's `Error`. The compiler enforces it: the contract cannot import the core |
| `core/src/errors/` | a port raises it and the use case handles it without letting it out |
| exception | infrastructure failures and programming errors. At the edge they become a generic message, with the stack only in development |

`ConflictError` lives in the contract and belongs to the `Error` of every use
case that writes (see `persistence.md`).

## Names

English, from a small set of shapes: `<Entity>NotFoundError`,
`Invalid<X>Error`, `<X>TakenError`, `Incomplete<X>Error`, `Locked<X>Error`,
`<X>Without<Y>Error`, `Outdated<X>Error`.

## Showing errors

The caller tells errors apart by `_tag`. User-facing messages live in the app,
in an object typed on the tags:

```ts
// apps/webapp/app/errors.ts
type ErrorOf<U> = U extends { execute(...args: never[]): Promise<Result<unknown, infer E>> }
    ? E
    : never;

/** Errors of the modules whose use cases the interface shows to the user. */
export type ShownError = {
    [K in keyof UseCaseRegistry]: K extends `${"expenses" | "members"}.${string}`
        ? ErrorOf<UseCaseRegistry[K]>
        : never;
}[keyof UseCaseRegistry];

// One message per error, and none more.
const MESSAGES: Record<ShownError["_tag"], string> = {
    ExpenseNotFoundError: "This expense does not exist.",
    // …
};
```

An error without a message, or a message left without an error, does not
compile. A new module whose errors reach the user joins `ShownError`.

## On the wire

How an error travels over a medium is decided by whoever exposes it, when
needed, with its own encoding: not by the contract.
