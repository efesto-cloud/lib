import EnvVarError from "./EnvVarError.js";

export default class ExpectedIntegerEnvVarError extends EnvVarError<{
    key: string;
    value: string;
}> {
    constructor(key: string, value: string) {
        super(
            `Expected integer for environment variable: {key}, but got: {value}`,
            { key, value },
        );
    }
}
