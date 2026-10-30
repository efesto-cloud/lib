// Written once, run on both channels: what a client sees must not depend on how it calls.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { bootstrapBus } from "@expenses/bootstrap/bus";
import { type Bus, InternalError, InvalidInput } from "@expenses/commands";
import { Forbidden, InvalidTransition, Unauthenticated } from "@expenses/core";
import { seededStore } from "@expenses/stub-adapter";
import { Result } from "effect";
import { httpBus } from "../src/client.js";
import {
    type AuditEntry,
    audit,
    createDispatcher,
    type Dispatcher,
    httpChannel,
    inProcessBus,
} from "../src/index.js";

const channels: Record<
    string,
    (dispatcher: Dispatcher, token: string | null) => Bus
> = {
    "in-process": inProcessBus,
    http: (dispatcher, token) => {
        const handle = httpChannel(dispatcher);
        return httpBus({
            url: "http://bus.test",
            token,
            fetch: (request) => handle(request as Request),
        });
    },
};

for (const [channel, connect] of Object.entries(channels)) {
    describe(`bus over ${channel}`, () => {
        let dispatcher: Dispatcher;
        let entries: AuditEntry[];
        const as = (token: string | null) => connect(dispatcher, token);

        beforeEach(async () => {
            entries = [];
            const core = await bootstrapBus(
                { MOCK: "1" },
                { store: seededStore() },
            );
            dispatcher = createDispatcher(core, {
                middleware: [audit((entry) => entries.push(entry))],
            });
        });

        it("refuses a call without a valid token", async () => {
            const result = await as("nope").dispatch("listMyExpenses", {});
            assert.ok(
                Result.isFailure(result) &&
                    result.failure instanceof Unauthenticated,
            );
        });

        it("validates the input before the policy and the handler", async () => {
            const result = await as("carla-token").dispatch("createExpense", {
                description: "Taxi",
            } as never);
            assert.ok(
                Result.isFailure(result) &&
                    result.failure instanceof InvalidInput,
            );
            assert.equal(entries.length, 0);
        });

        it("applies the policy and names it", async () => {
            const result = await as("anna-token").dispatch(
                "listSubmittedExpenses",
                {},
            );
            assert.ok(
                Result.isFailure(result) && result.failure instanceof Forbidden,
            );
            assert.equal(result.failure.policy, "can(expenses.review)");
        });

        it("brings a declared error back as an instance of its class", async () => {
            const created = await as("anna-token").dispatch("createExpense", {
                description: "Taxi",
                amount_cents: 2400,
            });
            const expense = Result.getOrThrow(created);
            const result = await as("carla-token").dispatch("approveExpense", {
                expense_id: expense.id,
            });
            assert.ok(
                Result.isFailure(result) &&
                    result.failure instanceof InvalidTransition,
            );
            assert.equal(result.failure.from, "draft");
        });

        it("lets the middleware see command, actor, input and outcome", async () => {
            await as("anna-token").dispatch("listMyExpenses", {});
            assert.deepEqual(entries, [
                {
                    command: "listMyExpenses",
                    actor_id: "m-anna",
                    input: {},
                    outcome: "ok",
                },
            ]);
        });
    });
}

describe("undeclared errors", () => {
    it("cross the bus as a bare InternalError", async () => {
        const core = await bootstrapBus(
            { MOCK: "1" },
            { store: seededStore() },
        );
        const failing = createDispatcher({
            ...core,
            resolveUseCase: (() => ({
                execute: async () => {
                    throw new Error("database password is hunter2");
                },
            })) as never,
        });
        const original = console.error;
        console.error = () => {};
        const result = await channels
            .http?.(failing, "anna-token")
            .dispatch("listMyExpenses", {});
        console.error = original;
        assert.ok(
            result &&
                Result.isFailure(result) &&
                result.failure instanceof InternalError,
        );
        assert.deepEqual({ ...result.failure }, { _tag: "InternalError" });
    });
});
