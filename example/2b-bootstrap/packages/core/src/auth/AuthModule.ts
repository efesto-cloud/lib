import { ContainerModule } from "inversify";
import Authorizer from "./Authorizer.js";
import Identifier from "./Identifier.js";

export const Auth = {
    Authorizer: Symbol.for("Authorizer"),
    Identifier: Symbol.for("Identifier"),
} as const;

export const AuthModule = new ContainerModule(({ bind }) => {
    bind(Auth.Authorizer).to(Authorizer);
    bind(Auth.Identifier).to(Identifier);
});
