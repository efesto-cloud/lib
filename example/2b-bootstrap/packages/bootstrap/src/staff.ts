import { type BootOptions, boot, type Env } from "./base.js";

/** webapp-staff: no file import, so no file library. */
export function bootstrapStaff(env: Env, options?: BootOptions) {
    return boot(
        env,
        { requires: ["DB_PATH", "MAIL_URL", "QUEUE_PATH"], adapters: () => [] },
        options,
    );
}

export {
    type Booted,
    type BootOptions,
    type Env,
    MissingEnv,
    UseCaseUnavailable,
} from "./base.js";
