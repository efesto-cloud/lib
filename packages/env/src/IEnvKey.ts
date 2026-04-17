import type { Result } from "@efesto-cloud/result";
import type ExpectedBigIntEnvVarError from "./errors/ExpectedBigIntEnvVarError.js";
import type ExpectedBooleanEnvVarError from "./errors/ExpectedBooleanEnvVarError.js";
import type ExpectedFileEnvVarError from "./errors/ExpectedFileEnvVarError.js";
import type ExpectedFloatEnvVarError from "./errors/ExpectedFloatEnvVarError.js";
import type ExpectedIntegerEnvVarError from "./errors/ExpectedIntegerEnvVarError.js";
import type ExpectedValueEnvKeyError from "./errors/ExpectedValueEnvKeyError.js";

type TKownKeys<T> = keyof {
    [K in keyof T as string extends K
        ? never
        : number extends K
          ? never
          : K]: never;
};

export type EnvKeyName = TKownKeys<NodeJS.ProcessEnv>;

export default interface IEnvKey {
    string<K extends EnvKeyName>(key: K): NodeJS.ProcessEnv[K];
    stringSafe<K extends EnvKeyName>(
        key: K,
    ): Result<NonNullable<NodeJS.ProcessEnv[K]>, ExpectedValueEnvKeyError>;

    file(key: EnvKeyName): string;
    fileSafe(
        key: EnvKeyName,
    ): Result<string, ExpectedValueEnvKeyError | ExpectedFileEnvVarError>;

    integer(key: EnvKeyName): number;
    integerSafe(
        key: EnvKeyName,
    ): Result<number, ExpectedValueEnvKeyError | ExpectedIntegerEnvVarError>;

    bigInt(key: EnvKeyName): bigint;
    bigIntSafe(
        key: EnvKeyName,
    ): Result<bigint, ExpectedValueEnvKeyError | ExpectedBigIntEnvVarError>;

    float(key: EnvKeyName): number;
    floatSafe(
        key: EnvKeyName,
    ): Result<number, ExpectedValueEnvKeyError | ExpectedFloatEnvVarError>;

    boolean(key: EnvKeyName): boolean;
    booleanSafe(
        key: EnvKeyName,
    ): Result<boolean, ExpectedValueEnvKeyError | ExpectedBooleanEnvVarError>;

    something<T>(key: EnvKeyName, fn: (str: string) => T): T;
    somethingSafe<T, E>(
        key: EnvKeyName,
        fn: (str: string) => Result<T, E>,
    ): Result<T, ExpectedValueEnvKeyError | E>;
}
