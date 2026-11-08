# Use Case

`IUseCase<TInput, TResult, TContext>`: one business operation that always
answers with a `Result` of `better-result`.

The application declares its execution context once, with an alias that fixes it:

```ts
import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "better-result";

export type ExecutionContext = { actor: MemberDto };

export type UseCase<I, R extends Result<unknown, unknown>> = IUseCase<
    I,
    R,
    ExecutionContext
>;
```

No module augmentation: the context is a plain type parameter.
