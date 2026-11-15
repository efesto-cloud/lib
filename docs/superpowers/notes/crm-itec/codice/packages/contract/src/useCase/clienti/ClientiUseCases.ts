import type IAssignRagioneSociale from "./IAssignRagioneSociale.js";
import type ICreateCliente from "./ICreateCliente.js";
import type IListClienti from "./IListClienti.js";
import type IListRagioniSociali from "./IListRagioniSociali.js";
import type IRenameCliente from "./IRenameCliente.js";

/** Gli use case del modulo `clienti`, per chiave. */
type ClientiUseCases = {
    "clienti.AssignRagioneSociale": IAssignRagioneSociale;
    "clienti.CreateCliente": ICreateCliente;
    "clienti.ListClienti": IListClienti;
    "clienti.ListRagioniSociali": IListRagioniSociali;
    "clienti.RenameCliente": IRenameCliente;
};

export default ClientiUseCases;
