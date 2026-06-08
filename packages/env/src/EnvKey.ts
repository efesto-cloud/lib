/** biome-ignore-all lint/suspicious/noGlobalIsNan: Ignore this */
import fs from "node:fs";
import process from "node:process";
import Result from "@efesto-cloud/result";
import ExpectedBigIntEnvVarError from "./errors/ExpectedBigIntEnvVarError.js";
import ExpectedBooleanEnvVarError from "./errors/ExpectedBooleanEnvVarError.js";
import ExpectedFileEnvVarError from "./errors/ExpectedFileEnvVarError.js";
import ExpectedFloatEnvVarError from "./errors/ExpectedFloatEnvVarError.js";
import ExpectedIntegerEnvVarError from "./errors/ExpectedIntegerEnvVarError.js";
import ExpectedValueEnvKeyError from "./errors/ExpectedValueEnvKeyError.js";
import type IEnvKey from "./IEnvKey.js";
import type { EnvKeyName } from "./IEnvKey.js";

const TRUTHY_VALUES = new Set([
    "true",
    "1",
    "yes",
    "y",
    "si",
    "s",
    "on",
    "enabled",
    "ok",
]);
const FALSY_VALUES = new Set([
    "false",
    "0",
    "no",
    "n",
    "off",
    "disabled",
    "ko",
]);

const cache = new Map<EnvKeyName, string>();

function stringSafe<K extends EnvKeyName>(
    key: K,
): Result<NonNullable<NodeJS.ProcessEnv[K]>, ExpectedValueEnvKeyError> {
    const cached = cache.get(key);
    if (cached !== undefined) return Result.ok(cached);
    const value = process.env[key];
    if (value === undefined)
        return Result.err(new ExpectedValueEnvKeyError(key));
    cache.set(key, value);
    return Result.ok(value);
}

function integerSafe(
    key: EnvKeyName,
): Result<number, ExpectedValueEnvKeyError | ExpectedIntegerEnvVarError> {
    return stringSafe(key).andThen((str) => {
        const val = parseInt(str, 10);
        return isNaN(val)
            ? Result.err(new ExpectedIntegerEnvVarError(key, str))
            : Result.ok(val);
    });
}

function floatSafe(
    key: EnvKeyName,
): Result<number, ExpectedValueEnvKeyError | ExpectedFloatEnvVarError> {
    return stringSafe(key).andThen((str) => {
        const val = parseFloat(str);
        return isNaN(val)
            ? Result.err(new ExpectedFloatEnvVarError(key, str))
            : Result.ok(val);
    });
}

function bigIntSafe(
    key: EnvKeyName,
): Result<bigint, ExpectedValueEnvKeyError | ExpectedBigIntEnvVarError> {
    return stringSafe(key).andThen((str) => {
        try {
            return Result.ok(BigInt(str));
        } catch (err) {
            if (err instanceof TypeError)
                return Result.err(new ExpectedBigIntEnvVarError(key, str));
            throw err;
        }
    });
}

function booleanSafe(
    key: EnvKeyName,
): Result<boolean, ExpectedValueEnvKeyError | ExpectedBooleanEnvVarError> {
    return stringSafe(key).andThen((str) => {
        if (TRUTHY_VALUES.has(str)) return Result.ok(true);
        if (FALSY_VALUES.has(str)) return Result.ok(false);
        return Result.err(new ExpectedBooleanEnvVarError(key, str));
    });
}

function somethingSafe<T, E>(
    key: EnvKeyName,
    fn: (str: string) => Result<T, E>,
): Result<T, ExpectedValueEnvKeyError | E> {
    return stringSafe(key).andThen(fn);
}

function fileSafe(
    key: EnvKeyName,
): Result<string, ExpectedValueEnvKeyError | ExpectedFileEnvVarError> {
    return stringSafe(key).andThen((path) =>
        fs.existsSync(path)
            ? Result.ok(fs.readFileSync(path, "utf8").toString().trim())
            : Result.err(new ExpectedFileEnvVarError(key, path)),
    );
}

export default {
    stringSafe,
    integerSafe,
    floatSafe,
    bigIntSafe,
    booleanSafe,
    fileSafe,
    somethingSafe,

    string: <K extends EnvKeyName>(key: K) =>
        stringSafe<K>(key).unwrapOrThrow(),
    integer: (key: EnvKeyName) => integerSafe(key).unwrapOrThrow(),
    float: (key: EnvKeyName) => floatSafe(key).unwrapOrThrow(),
    bigInt: (key: EnvKeyName) => bigIntSafe(key).unwrapOrThrow(),
    boolean: (key: EnvKeyName) => booleanSafe(key).unwrapOrThrow(),
    file: (key: EnvKeyName) => fileSafe(key).unwrapOrThrow(),
    something: <T>(key: EnvKeyName, fn: (str: string) => T) =>
        somethingSafe(key, (str) => Result.ok(fn(str))).unwrapOrThrow(),
} satisfies IEnvKey;
