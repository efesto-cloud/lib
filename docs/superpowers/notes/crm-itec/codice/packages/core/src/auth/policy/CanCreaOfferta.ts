import { injectable } from "inversify";
import CreateOnBuPolicy from "~/auth/policy/CreateOnBuPolicy.js";

@injectable()
export default class CanCreaOfferta extends CreateOnBuPolicy {
    protected readonly azione = "offerta.crea";
}
