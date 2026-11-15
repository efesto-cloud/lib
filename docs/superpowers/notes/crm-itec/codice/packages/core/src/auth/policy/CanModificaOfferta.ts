import type Azione from "@itec/contract/type/Azione";
import { injectable } from "inversify";
import OffertaPolicy from "~/auth/policy/OffertaPolicy.js";

@injectable()
export default class CanModificaOfferta extends OffertaPolicy {
    protected azione(): Azione {
        return "offerta.modifica";
    }
}
