import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { bootstrapAdmin } from "../src/admin.js";
import {
    bootstrapStaff,
    MissingEnv,
    UseCaseUnavailable,
} from "../src/staff.js";

const dir = mkdtempSync(join(tmpdir(), "expenses-"));
const env = {
    DB_PATH: join(dir, "db.sqlite"),
    MAIL_URL: "http://mail.test",
    QUEUE_PATH: join(dir, "queue.sqlite"),
};

describe("profiles", () => {
    it("names the missing environment instead of failing later", async () => {
        await assert.rejects(
            bootstrapStaff({ DB_PATH: env.DB_PATH }),
            (error) => {
                assert.ok(error instanceof MissingEnv);
                assert.deepEqual(error.keys, ["MAIL_URL", "QUEUE_PATH"]);
                return true;
            },
        );
    });

    it("staff does not load the file adapter: only the use case that needs it fails", async () => {
        const staff = await bootstrapStaff(env);
        assert.ok(staff.resolveUseCase("expenses.CreateExpense"));
        assert.throws(
            () => staff.resolveUseCase("expenses.ImportExpenses"),
            UseCaseUnavailable,
        );
    });

    it("admin loads it", async () => {
        const admin = await bootstrapAdmin(env);
        assert.ok(admin.resolveUseCase("expenses.ImportExpenses"));
    });
});
