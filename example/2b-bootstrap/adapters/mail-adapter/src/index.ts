import { Port } from "@expenses/core";
import { ContainerModule } from "inversify";
import HttpMailer from "./HttpMailer.js";

export function installMail(config: { url: string }) {
    return new ContainerModule(({ bind }) => {
        bind(Port.Mailer).toConstantValue(new HttpMailer(config.url));
    });
}
