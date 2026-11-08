import type { ExpenseDto } from "@expenses/contract/dto/ExpenseDto";
import type { MemberDto } from "@expenses/contract/dto/MemberDto";
import type ExpenseStatusChange from "@expenses/core/entity/ExpenseStatusChange";
import type { Job } from "@expenses/core/service/IJobQueue";

type State = {
    members: Map<string, MemberDto & { token: string }>;
    expenses: Map<string, ExpenseDto>;
    changes: ExpenseStatusChange[];
    jobs: Job[];
};

/**
 * The in-memory database. It keeps rows, not entities, so that a saved
 * entity changed afterwards does not change what is stored, as in a real one.
 */
export default class StubStore {
    state: State = {
        members: new Map(),
        expenses: new Map(),
        changes: [],
        jobs: [],
    };
    readonly sentMail: { to: string; subject: string }[] = [];

    snapshot(): State {
        return structuredClone(this.state);
    }

    restore(state: State) {
        this.state = state;
    }
}
