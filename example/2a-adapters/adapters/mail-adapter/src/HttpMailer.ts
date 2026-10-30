import type { IMailer } from "@expenses/core";

/** Posts to the mail provider's HTTP endpoint. */
export default class HttpMailer implements IMailer {
    constructor(private readonly url: string) {}

    async send(mail: { to: string; subject: string }) {
        const response = await fetch(this.url, {
            method: "POST",
            body: JSON.stringify(mail),
        });
        if (!response.ok)
            throw new Error(`Mail provider answered ${response.status}`);
    }
}
