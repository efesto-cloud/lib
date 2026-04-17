import EnvVarError from "./EnvVarError.js";

export default class ExpectedBooleanEnvVarError extends EnvVarError<{
    key: string;
    value: string;
}> {
    constructor(key: string, value: string) {
        super(
            `Expected boolean for environment variable: {key}, but got: {value}`,
            { key, value },
        );
    }
}
