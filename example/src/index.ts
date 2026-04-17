import type IUseCase from "@efesto-cloud/usecase";
import type { IExecutionContext } from "@efesto-cloud/usecase";

export class ExampleUseCase implements IUseCase<string, string> {
    name = "ExampleUseCase";

    async execute(input: string, context: IExecutionContext): Promise<string> {
        console.log("Input:", input);
        console.log("Context:", context);

        return `Hello, ${input}!`;
    }
}
