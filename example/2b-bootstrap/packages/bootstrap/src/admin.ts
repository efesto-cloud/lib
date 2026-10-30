import { installFile } from "@expenses/file-adapter";
import { type BootOptions, boot, type Env } from "./base.js";

/** webapp-admin: the only profile that loads the heavy file adapter. */
export function bootstrapAdmin(env: Env, options?: BootOptions) {
    return boot(
        env,
        {
            requires: ["DB_PATH", "MAIL_URL", "QUEUE_PATH"],
            adapters: () => [installFile()],
        },
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
