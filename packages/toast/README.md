# @efesto-cloud/toast

A `Toast<T, E>` monad — a `Result<T, E>` with a user-facing `message` attached. Use it at the UI boundary when you want a success/failure outcome **and** a ready-to-display message ("Saved", "Upload failed", …).

## Installation

```bash
pnpm add @efesto-cloud/toast @efesto-cloud/result @efesto-cloud/maybe
```

## Quick Start

```ts
import Toast from "@efesto-cloud/toast";

function save(data: unknown) {
    if (!isValid(data)) return Toast.err("Dati non validi", new Error("invalid"));
    return Toast.ok("Salvato", data);
}

const t = save(input);

if (t.isFailure()) {
    showError(t.message);
} else {
    showSuccess(t.message);
    consume(t.data);
}
```

## API

### Constructors

```ts
Toast.ok(message);                 // ToastSuccess<void>
Toast.ok(message, value);          // ToastSuccess<T>
Toast.err(message);                // ToastFailure<void>
Toast.err(message, error);         // ToastFailure<E>

Toast.fromObject({ success, message, data, error });

// Lift a Result into a Toast with an attached message.
Toast.fromResult(result);
Toast.fromResult(result, "Salvato");
Toast.fromResult(result, "Salvato", "Salvataggio fallito");
```

`fromResult` defaults:

- success → `"Operazione eseguita"` (unless `ok_message` is given).
- failure → uses `err_message` if provided; otherwise uses the error's `.message` if it has one; otherwise `"Operazione fallita!"`.

### Instance methods

Same shape as `Result`, with one extra field. The contained `message` is
preserved across `map` / `mapError` / `tap`; `flatMap`/`andThen` and `orElse`
adopt the message of the `Toast` they return.

| Method | Purpose |
| --- | --- |
| `message` | The user-facing message. |
| `isSuccess()` / `isFailure()` | Type guards. |
| `map(fn)` | Transform `data`; error and message pass through. |
| `mapError(fn)` | Transform `error`; data and message pass through. |
| `flatMap(fn)` / `andThen(fn)` | Chain another `Toast`. |
| `orElse(fn)` | Recover from a failure by returning a new `Toast`. |
| `match(onOk, onErr)` | Collapse to a single value (success-first). |
| `tap(fn)` | Side-effect on success; passes through. |
| `tapError(fn)` | Side-effect on failure; passes through. |
| `unwrapOr(fallback)` | `data`, or `fallback` on failure. |
| `unwrapOrThrow()` | Return `data` or throw `error`. |
| `toObject()` | Plain `{ success, message, data, error }`. |
| `toMaybe()` | `Some(data)` if success, `None` if failure. |

Factories are available both as namespace members (`Toast.ok(...)`) and as named
imports (`import { ok, err, fromResult } from "@efesto-cloud/toast"`).

#### Compatibility aliases

| Method | Prefer |
| --- | --- |
| `fold(onErr, onOk)` | `match(onOk, onErr)` |
| `run(fn)` | `tap(fn)` |
| `else(() => value)` | `unwrapOr(value)` when you want the raw value |

## When to use `Toast` vs `Result`

- **`Result<T, E>`** — internal boundaries, business logic, anywhere the caller decides how to present errors.
- **`Toast<T, E>`** — the outermost layer where you already know what to tell the user.

A common pattern: business logic returns `Result`, the controller/action wraps it once with `Toast.fromResult(result, okMsg, errMsg)` before returning it to the UI.

## Types

```ts
type IToast<T, E> = IToastSuccess<T, E> | IToastFailure<E, T>;

interface IToastSuccess<T, E> { success: true;  message: string; data: T; error?: E; }
interface IToastFailure<E, T> { success: false; message: string; data?: T; error: E; }
```
