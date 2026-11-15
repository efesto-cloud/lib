import type ClientiUseCases from "@itec/contract/useCase/clienti/ClientiUseCases";
import type { UseCaseImplementations } from "~/di/useCaseModule.js";
import AssignRagioneSociale from "./impl/AssignRagioneSociale.js";
import CreateCliente from "./impl/CreateCliente.js";
import ListClienti from "./impl/ListClienti.js";
import ListRagioniSociali from "./impl/ListRagioniSociali.js";
import RenameCliente from "./impl/RenameCliente.js";

const ClientiModule: UseCaseImplementations<ClientiUseCases> = {
    "clienti.AssignRagioneSociale": AssignRagioneSociale,
    "clienti.CreateCliente": CreateCliente,
    "clienti.ListClienti": ListClienti,
    "clienti.ListRagioniSociali": ListRagioniSociali,
    "clienti.RenameCliente": RenameCliente,
};

export default ClientiModule;
