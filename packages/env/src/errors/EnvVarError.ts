/**
 * @description
 * Given a message template with placeholders, and a context object, returns the message with the placeholders replaced with the values from the context object.
 *
 */
function templateMessage(message: string, ctx: Record<string, string>): string {
    return message.replace(/\{(\w+)\}/g, (_, key) => ctx[key] ?? "");
}

export default class EnvVarError<
    C extends Record<string, string>,
> extends Error {
    readonly ctx: C;

    constructor(message: string, ctx: C) {
        super(templateMessage(message, ctx));
        this.ctx = ctx;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
