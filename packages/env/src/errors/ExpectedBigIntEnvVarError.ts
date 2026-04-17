import EnvVarError from "./EnvVarError.js";

export default class ExpectedBigIntEnvVarError extends EnvVarError<{
    key: string;
    value: string;
}> {
    constructor(key: string, value: string) {
        super(
            `Expected bigint for environment variable: {key}, but got: {value}`,
            { key, value },
        );
    }
}
