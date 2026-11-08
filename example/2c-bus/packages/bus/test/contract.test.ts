// Written once, run on both channels: what a client sees must not depend on how it calls.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { bootstrapBus } from "@expenses/bootstrap/bus";
import type { Api } from "@expenses/contract/api";
import Forbidden from "@expenses/contract/errors/Forbidden";
import InternalError from "@expenses/contract/errors/InternalError";
import InvalidInput from "@expenses/contract/errors/InvalidInput";
import InvalidTransition from "@expenses/contract/errors/InvalidTransition";
import Unauthenticated from "@expenses/contract/errors/Unauthenticated";
import { seededStore } from "@expenses/stub-adapter";
import { Result } from "better-result";
import { httpApi } from "../src/channels/http-client.js";
import { httpChannel } from "../src/channels/http-server.js";
import { inProcessApi } from "../src/channels/in-process.js";
import { createDispatcher, type Dispatcher } from "../src/dispatcher.js";
import { type AuditEntry, audit } from "../src/middleware/audit.js";

const channels: Record<
    string,
    (dispatcher: Dispatcher, token: string | null) => Api
> = {
    "in-process": inProcessApi,
    http: (dispatcher, token) => {
        const handle = httpChannel(dispatcher);
        return httpApi({
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
            const result = await as("nope").dispatch(
                "expenses.ListMyExpenses",
                {},
            );
            assert.ok(
                Result.isError(result) &&
                    result.error instanceof Unauthenticated,
            );
        });

        it("validates the input before the policy and the handler", async () => {
            const result = await as("carla-token").dispatch(
                "expenses.CreateExpense",
                {
                    description: "Taxi",
                } as never,
            );
            assert.ok(
                Result.isError(result) && result.error instanceof InvalidInput,
            );
            assert.equal(entries.length, 0);
        });

        it("applies the policy and names it", async () => {
            const result = await as("anna-token").dispatch(
                "expenses.ListSubmittedExpenses",
                {},
            );
            assert.ok(
                Result.isError(result) && result.error instanceof Forbidden,
            );
            assert.equal(result.error.policy, "can(expenses.review)");
        });

        it("brings a declared error back as an instance of its class", async () => {
            const created = await as("anna-token").dispatch(
                "expenses.CreateExpense",
                {
                    description: "Taxi",
                    amount_cents: 2400,
                },
            );
            const expense = created.unwrap();
            const result = await as("carla-token").dispatch(
                "expenses.ApproveExpense",
                {
                    expense_id: expense.id,
                },
            );
            assert.ok(
                Result.isError(result) &&
                    result.error instanceof InvalidTransition,
            );
            assert.equal(result.error.from, "draft");
        });

        it("lets the middleware see command, actor, input and outcome", async () => {
            await as("anna-token").dispatch("expenses.ListMyExpenses", {});
            assert.deepEqual(entries, [
                {
                    useCase: "expenses.ListMyExpenses",
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
            .dispatch("expenses.ListMyExpenses", {});
        console.error = original;
        assert.ok(
            result &&
                Result.isError(result) &&
                result.error instanceof InternalError,
        );
        // Only the tag crosses: no stack, no message, no cause.
        const { name: _name, ...fields } = { ...result.error };
        assert.deepEqual(fields, { _tag: "InternalError" });
    });
});
