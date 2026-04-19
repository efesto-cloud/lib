import { type SerializeOptions, parse, serialize } from "cookie";
import { Request } from "koa";

export default class AuthCookie {
    constructor(
        private readonly COOKIE_NAME: string,
        private readonly MAX_AGE: string,
        private readonly ROOT_URL: string,
    ) {}

    parse(request: Request) {
        if (!request.headers) return;
        const cookies = parse(request.headers.cookie || "");
        return cookies[this.COOKIE_NAME];
    }

    serialize(value?: string) {
        if (!value)
            return serialize(this.COOKIE_NAME, "", {
                ...this.defaultSettings(),
                expires: new Date(0),
            });
        return serialize(this.COOKIE_NAME, value, this.defaultSettings());
    }

    private defaultSettings(): SerializeOptions {
        return {
            httpOnly: true,
            sameSite: "strict",
            maxAge: parseInt(this.MAX_AGE),
            secure: new URL(this.ROOT_URL).protocol === "https:",
            domain: new URL(this.ROOT_URL).hostname,
            // path: "/",
        } satisfies SerializeOptions;
    }
}