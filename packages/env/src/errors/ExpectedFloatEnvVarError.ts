import EnvVarError from "./EnvVarError.js";

export default class ExpectedFloatEnvVarError extends EnvVarError<{
    key: string;
    value: string;
}> {
    constructor(key: string, value: string) {
        super(
            `Expected float for environment variable: {key}, but got: {value}`,
            { key, value },
        );
    }
}
