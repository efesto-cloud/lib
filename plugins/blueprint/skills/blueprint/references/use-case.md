# Use cases

## Does / does not

| Does | Does not |
|---|---|
| receives an object of the declared type, never positional arguments, plus the context: `execute(input, ctx)` | revalidate the input's shape: it keeps only domain rules, with their errors |
| applies domain rules through entities and the pure functions in `core/rule/` | read requests, cookies, environment variables |
| always returns a `Result` | change an entity's `v` |
| writes inside `uow.runWithTransaction`, and then its `Error` includes `ConflictError` | decide who may run it (authorization is open, see `open-questions.md`) |

## Implementation

```ts
// core/src/useCase/expenses/impl/ApproveExpense.ts
import type ConflictError from "@acme/contract/errors/ConflictError";
import ExpenseNotFoundError from "@acme/contract/errors/ExpenseNotFoundError";
import type InvalidTransitionError from "@acme/contract/errors/InvalidTransitionError";
import type IExpense from "@acme/contract/interface/IExpense";
import type IApproveExpense from "@acme/contract/useCase/expenses/IApproveExpense";
import type { ApproveExpenseInput } from "@acme/contract/useCase/expenses/IApproveExpense";
import { Result } from "better-result";
import { inject, injectable } from "inversify";
import InternalSymbols from "~/di/InternalSymbols.js";
import type IExpenseRepository from "~/repo/IExpenseRepository.js";
import type IUnitOfWork from "~/repo/IUnitOfWork.js";

@injectable()
export default class ApproveExpense implements IApproveExpense {
    constructor(
        @inject(InternalSymbols.UnitOfWork) private readonly uow: IUnitOfWork,
        @inject(InternalSymbols.Repo.Expense) private readonly expenses: IExpenseRepository,
    ) {}

    async execute({ expense_id, now }: ApproveExpenseInput): Promise<
        Result<IExpense, ConflictError | ExpenseNotFoundError | InvalidTransitionError>
    > {
        return this.uow.runWithTransaction(async () => {
            const expense = await this.expenses.findById(expense_id);
            if (!expense) return Result.err(new ExpenseNotFoundError());
            const approved = expense.approve(now);
            if (approved.isErr()) return Result.err(approved.error);
            this.expenses.save(expense);
            return Result.ok(expense.toDTO());
        });
    }
}
```

- `@injectable() export default class <Name> implements I<Name>`.
- Dependencies come through the constructor with `@inject(Symbol)`:
  `InternalSymbols.Repo.<X>`, `InternalSymbols.Service.<X>`,
  `InternalSymbols.UnitOfWork`. Nothing container-specific inside a use case
  (no `container.get`).
- The `execute` signature repeats the full `Result` type; the input is
  destructured; `ctx` is omitted when unused.

## Module

```ts
// core/src/useCase/expenses/ExpensesModule.ts
import type ExpensesUseCases from "@acme/contract/useCase/expenses/ExpensesUseCases";
import type { UseCaseImplementations } from "~/di/useCaseModule.js";
import ApproveExpense from "./impl/ApproveExpense.js";
import SubmitExpense from "./impl/SubmitExpense.js";

const ExpensesModule: UseCaseImplementations<ExpensesUseCases> = {
    "expenses.ApproveExpense": ApproveExpense,
    "expenses.SubmitExpense": SubmitExpense,
};

export default ExpensesModule;
```

A module is a plain object key → class, not a `ContainerModule`. The core's
`install` spreads every module into one `useCaseModule<UseCaseRegistry>(…)`
(see `composition.md`): a missing key, an implementation that does not match
its interface, or a forgotten module do not compile.

## Shared logic

Logic shared by several use cases is a **function**, not a use case: in
`core/src/useCase/<name>.ts` when it spans modules, in
`core/src/useCase/<module>/impl/<name>.ts` when it belongs to one module. It
receives its dependencies as arguments.

## A use case calling a use case

Allowed, on these conditions:

- it receives the other one by key, typed on its interface:
  `@inject("expenses.GetExpense") private readonly expense: IGetExpense`;
- it passes the same `ctx`;
- it shares the Unit of Work because both are resolved in the same resolution;
- no cycles.

## The context

- `execute(input, context: ExecutionContext)`: the type is the contract's.
- Who acts on themselves comes from the context; who acts on someone else has
  that someone's id in the input.
- A helper that reads the actor and throws when it is missing is fine: a
  missing actor where one is required is a programming error, not a domain case.

## Adding a use case to module `m`

1. `contract/src/useCase/m/I<Name>.ts`: the interface with its `Error` and,
   in the same file, `<Name>Input` (schema and type).
2. One line in `contract/src/useCase/m/<M>UseCases.ts`.
3. `core/src/useCase/m/impl/<Name>.ts`.
4. One line in `core/src/useCase/m/<M>Module.ts`.
5. If a new error reaches the user, its message in the app (see `errors.md`).

A new module: its type in the contract and one line in `registry.ts`; its
`<M>Module.ts` in the core and one line in `di/install.ts`.
