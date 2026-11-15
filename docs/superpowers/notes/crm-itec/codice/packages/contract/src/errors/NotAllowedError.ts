import { TaggedError } from "better-result";
import type Azione from "~/type/Azione.js";

/**
 * Chi agisce non può fare questa azione. `regola` dice cosa non è passato: il
 * nome della policy, o `Matrice`; per la matrice, `azione` è la casella che
 * manca.
 */
export default class NotAllowedError extends TaggedError("NotAllowedError")<{
    regola: string;
    azione?: Azione;
}> {}
