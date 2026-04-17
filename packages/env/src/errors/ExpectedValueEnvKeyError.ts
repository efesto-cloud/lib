import EnvVarError from "./EnvVarError.js";

export default class ExpectedValueEnvKeyError extends EnvVarError<{
    key: string;
}> {
    constructor(key: string) {
        super(`Environment variable "{key}" is not defined`, { key });
    }
}
