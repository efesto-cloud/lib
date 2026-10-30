import type { IMailer } from "@expenses/core";
import type StubStore from "./StubStore.js";

export default class StubMailer implements IMailer {
    constructor(private readonly store: StubStore) {}

    async send(mail: { to: string; subject: string }) {
        this.store.sentMail.push(mail);
    }
}
