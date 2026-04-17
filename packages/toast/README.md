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

Same shape as `Result`, with one extra field:

| Method | Purpose |
| --- | --- |
| `message` | The user-facing message. |
| `isSuccess()` / `isFailure()` | Type guards. |
| `unwrapOrThrow()` | Return `data` or throw `error`. |
| `map(fn)` / `flatMap(fn)` | Transform / chain. |
| `fold(onErr, onOk)` | Collapse to a single value. |
| `else(() => value)` | Fallback value on failure. |
| `run(fn)` | Side-effect on success. |
| `toObject()` | Plain `{ success, message, data, error }`. |
| `toMaybe()` | `Some(data)` if success, `None` if failure. |

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
