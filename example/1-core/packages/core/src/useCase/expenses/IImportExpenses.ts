import type IUseCase from "@efesto-cloud/usecase";
import type { Result } from "effect";
import type ImportRowInvalid from "../../errors/ImportRowInvalid.js";
import type InvalidFile from "../../errors/InvalidFile.js";

interface IImportExpenses
    extends IUseCase<
        IImportExpenses.Input,
        Result.Result<{ created: number }, IImportExpenses.Error>
    > {}

namespace IImportExpenses {
    export type Input = { file: string };
    export type Error = InvalidFile | ImportRowInvalid;
}

export type { IImportExpenses as default };
