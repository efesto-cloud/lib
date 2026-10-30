// Use cases tested against the stub: no database, no network.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
    installStub,
    type StubStore,
    seededStore,
} from "@expenses/stub-adapter";
import { Result } from "effect";
import { Container } from "inversify";
import {
    AuthModule,
    ExpensesModule,
    type MemberDto,
    type ResolveUseCase,
} from "../src/server.js";

const anna: MemberDto = {
    id: "m-anna",
    name: "Anna",
    email: "anna@example.com",
    role: "staff",
};
const carla: MemberDto = {
    id: "m-carla",
    name: "Carla",
    email: "carla@example.com",
    role: "admin",
};

let store: StubStore;
let resolve: ResolveUseCase;

beforeEach(async () => {
    store = seededStore();
    const container = new Container();
    await container.load(installStub(store), AuthModule, ExpensesModule);
    resolve = (key) => container.get(key);
});

async function draft(description = "Taxi", amount_cents = 2400) {
    const created = await resolve("expenses.CreateExpense").execute(
        { description, amount_cents },
        { actor: anna },
    );
    return Result.getOrThrow(created);
}

describe("CreateExpense", () => {
    it("uses the actor as author", async () => {
        const expense = await draft();
        assert.equal(expense.author_id, "m-anna");
        assert.equal(expense.status, "draft");
    });

    it("returns InvalidAmount instead of throwing", async () => {
        const result = await resolve("expenses.CreateExpense").execute(
            { description: "Taxi", amount_cents: 0 },
            { actor: anna },
        );
        assert.ok(Result.isFailure(result));
        assert.equal(result.failure._tag, "InvalidAmount");
    });
});

describe("ApproveExpense", () => {
    it("writes the history row and queues the notification", async () => {
        const expense = await draft();
        await resolve("expenses.SubmitExpense").execute(
            { expense_id: expense.id },
            { actor: anna },
        );
        const result = await resolve("expenses.ApproveExpense").execute(
            { expense_id: expense.id },
            { actor: carla },
        );

        assert.equal(Result.getOrThrow(result).status, "approved");
        assert.deepEqual(
            store.state.changes.map((c) => [c.from, c.to, c.changed_by]),
            [
                ["draft", "submitted", "m-anna"],
                ["submitted", "approved", "m-carla"],
            ],
        );
        assert.deepEqual(store.state.jobs, [
            {
                key: "expenses.NotifyAuthor",
                input: { expense_id: expense.id },
                context: { actor: carla },
            },
        ]);
        assert.equal(store.sentMail.length, 0);
    });

    it("refuses a draft with InvalidTransition and writes nothing", async () => {
        const expense = await draft();
        const result = await resolve("expenses.ApproveExpense").execute(
            { expense_id: expense.id },
            { actor: carla },
        );
        assert.ok(Result.isFailure(result));
        assert.equal(result.failure._tag, "InvalidTransition");
        assert.equal(store.state.changes.length, 0);
        assert.equal(store.state.jobs.length, 0);
    });
});

describe("NotifyAuthor", () => {
    it("mails the author: the job runs the use case, nothing more", async () => {
        const expense = await draft();
        await resolve("expenses.NotifyAuthor").execute(
            { expense_id: expense.id },
            { actor: carla },
        );
        assert.deepEqual(
            store.sentMail.map((m) => m.to),
            ["anna@example.com"],
        );
    });
});

describe("ImportExpenses", () => {
    it("calls CreateExpense in one transaction: a bad row undoes the good ones", async () => {
        const result = await resolve("expenses.ImportExpenses").execute(
            { file: "description,amount_cents\nHotel,9000\nPranzo,-1\n" },
            { actor: carla },
        );
        assert.ok(Result.isFailure(result));
        assert.deepEqual(
            { ...result.failure },
            { _tag: "ImportRowInvalid", row: 2, reason: "InvalidAmount" },
        );
        assert.equal(store.state.expenses.size, 0);
    });
});
