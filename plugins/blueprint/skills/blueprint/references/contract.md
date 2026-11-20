# The contract

The contract is the edge towards whoever calls: what a caller sees or sends.
It depends only on zod and better-result, never on the core. Ports do not live
here: they speak about entities, so they stay in the core.

```
packages/contract/src/
  useCase.ts                       UseCase<I, R>, ExecutionContext
  registry.ts                      UseCaseRegistry, UseCaseResolver
  useCase/
    Page.ts                        shared generic types, cross-module inputs
    expenses/
      ExpensesUseCases.ts          key → interface, one line per use case
      IApproveExpense.ts           interface + input schema (+ output)
      ExpenseData.ts               an input part shared inside the module
  interface/IExpense.ts            what comes out for an entity
  type/ExpenseState.ts             unions, simple structs, records
  enum/ExpenseState.ts             runtime version of a union
  dict/ExpenseStateDesc.ts         labels of a union
  errors/ExpenseNotFoundError.ts   errors that appear in a use case's Error
  <channel>/                       schemas of an inbound channel that is not a use case
```

## `UseCase` and `ExecutionContext`

```ts
// contract/src/useCase.ts
import type { Result } from "better-result";
import type IMember from "~/interface/IMember.js";

/** What every call carries besides its input. Absent where nobody acts. */
export type ExecutionContext = { member?: IMember };

/** A use case as its caller sees it. */
export interface UseCase<I, R extends Result<unknown, unknown>> {
    execute(input: I, context: ExecutionContext): Promise<R>;
}
```

- The interface lives in the project's contract, not in an external package.
- Two parameters only. The context is **not** a generic and not a
  `declare module` augmentation: it is the project's one `ExecutionContext`,
  fixed in the signature. Fields are optional when some callers have nobody
  acting (a seed, a scheduled process, before login).
- The context carries interfaces, not entities: an entity outside the Unit of
  Work would write outside the save contract.

## A use case interface and its input

```ts
// contract/src/useCase/expenses/IApproveExpense.ts
import type { Result } from "better-result";
import { z } from "zod";
import type ConflictError from "~/errors/ConflictError.js";
import type ExpenseNotFoundError from "~/errors/ExpenseNotFoundError.js";
import type InvalidTransitionError from "~/errors/InvalidTransitionError.js";
import type IExpense from "~/interface/IExpense.js";
import type { UseCase } from "~/useCase.js";

export const ApproveExpenseInput = z.object({
    expense_id: z.string(),
    now: z.date(),
});
export type ApproveExpenseInput = z.infer<typeof ApproveExpenseInput>;

export default interface IApproveExpense
    extends UseCase<
        ApproveExpenseInput,
        Result<IExpense, ConflictError | ExpenseNotFoundError | InvalidTransitionError>
    > {}
```

- The schema lives **in the same file** as the interface, with the same name
  for the schema and the inferred type: `<Name>Input`.
- An input part shared by several use cases is a schema of its own, named
  without `Input` (`ExpenseData`), composed with `.extend`. Inside the module if
  it belongs to the module, at the root of `useCase/` if it spans modules. A use
  case may reuse another's input.
- An output specific to one use case is `export interface <Name>Output` in the
  same file. Generic shapes such as `Page<T>` live at the root of `useCase/`.

## Module type and registry

```ts
// contract/src/useCase/expenses/ExpensesUseCases.ts
import type IApproveExpense from "./IApproveExpense.js";
import type ISubmitExpense from "./ISubmitExpense.js";

/** The use cases of the `expenses` module, by key. */
type ExpensesUseCases = {
    "expenses.ApproveExpense": IApproveExpense;
    "expenses.SubmitExpense": ISubmitExpense;
};

export default ExpensesUseCases;
```

```ts
// contract/src/registry.ts
import type ExpensesUseCases from "~/useCase/expenses/ExpensesUseCases.js";
import type MembersUseCases from "~/useCase/members/MembersUseCases.js";

/** Every use case, by key, one module per line. The key is also the container id. */
export type UseCaseRegistry = ExpensesUseCases & MembersUseCases;

/** `resolveUseCase("expenses.ApproveExpense")` returns the use case with its type. */
export type UseCaseResolver = <K extends keyof UseCaseRegistry>(
    key: K,
) => UseCaseRegistry[K];
```

No `declare module`: registration and type come from one place.

## What comes out: `interface/`

```ts
// contract/src/interface/IExpense.ts
import type ExpenseState from "~/type/ExpenseState.js";

export default interface IExpense {
    id: string;
    amount: number;
    state: ExpenseState;
}
```

- `I<Entity>` for an entity, `I<Name>` for a row that comes out
  (`IStatusChange`). A TypeScript `interface`: our own code produces it, so a
  runtime check would protect nothing.
- No `Dto` suffix, no schema.

## `type/`, `enum/`, `dict/`

```ts
// type/ExpenseState.ts
type ExpenseState = "draft" | "submitted" | "approved" | "rejected";
export default ExpenseState;

// enum/ExpenseState.ts
const ExpenseStateEnum: { [K in ExpenseState]: K } = {
    draft: "draft", submitted: "submitted", approved: "approved", rejected: "rejected",
};
export default ExpenseStateEnum;

// dict/ExpenseStateDesc.ts
const ExpenseStateDesc: { [K in ExpenseState]: string } = {
    draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected",
};
export default ExpenseStateDesc;
```

- `type/` holds string unions, simple structs and special structures (a
  `Record`). **Never something that represents an entity**: that is an
  interface in `interface/`.
- In a schema: `z.enum(ExpenseStateEnum)`.
- The core may have its own `type/` and `enum/` for port types that never leave
  it.

## Inbound channels that are not use cases

When another process of ours sends data to an app over its own channel (a
signed HTTP payload, for instance), the payload schemas and the signature
format live in the contract under a folder named after the channel. For the
receiver they are an input, so they stay schemas.
