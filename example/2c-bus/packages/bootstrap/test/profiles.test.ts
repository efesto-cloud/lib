import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { bootstrapBus, MissingEnv } from "../src/bus.js";
import { bootstrapConsumer, UseCaseUnavailable } from "../src/consumer.js";

const dir = mkdtempSync(join(tmpdir(), "expenses-"));
const env = {
    DB_PATH: join(dir, "db.sqlite"),
    MAIL_URL: "http://mail.test",
    QUEUE_PATH: join(dir, "queue.sqlite"),
};

describe("profiles", () => {
    it("names the missing environment instead of failing later", async () => {
        await assert.rejects(
            bootstrapBus({ DB_PATH: env.DB_PATH }),
            (error) => {
                assert.ok(error instanceof MissingEnv);
                assert.deepEqual(error.keys, ["MAIL_URL", "QUEUE_PATH"]);
                return true;
            },
        );
    });

    it("the consumer does not load the file adapter: only the use case that needs it fails", async () => {
        const consumer = await bootstrapConsumer(env);
        assert.ok(consumer.resolveUseCase("expenses.NotifyAuthor"));
        assert.throws(
            () => consumer.resolveUseCase("expenses.ImportExpenses"),
            UseCaseUnavailable,
        );
    });

    it("the bus loads it", async () => {
        const bus = await bootstrapBus(env);
        assert.ok(bus.resolveUseCase("expenses.ImportExpenses"));
    });
});
