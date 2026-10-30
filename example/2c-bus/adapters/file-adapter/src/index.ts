import { Port } from "@expenses/core";
import { ContainerModule } from "inversify";
import CsvExpenseFileReader from "./CsvExpenseFileReader.js";

export function installFile() {
    return new ContainerModule(({ bind }) => {
        bind(Port.ExpenseFileReader).toConstantValue(
            new CsvExpenseFileReader(),
        );
    });
}
