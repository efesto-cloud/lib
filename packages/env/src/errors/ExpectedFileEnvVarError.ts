import EnvVarError from "./EnvVarError.js";

export default class ExpectedFileEnvVarError extends EnvVarError<{
    key: string;
    path: string;
}> {
    constructor(key: string, path: string) {
        super(`File not found for environment variable: {key}, path: {path}`, {
            key,
            path,
        });
    }
}
