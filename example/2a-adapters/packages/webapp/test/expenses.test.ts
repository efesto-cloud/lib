// The same scenario runs unchanged on every rung: only harness.ts changes.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { start } from "./harness.js";

const ANNA = "anna-token";
const BRUNO = "bruno-token";
const CARLA = "carla-token";

let app: Awaited<ReturnType<typeof start>>;
before(async () => {
    app = await start();
});
after(() => app.stop());

async function call(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    let payload: string | undefined;
    if (typeof body === "string") {
        headers["content-type"] = "text/csv";
        payload = body;
    } else if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
    }
    const response = await app.handle(
        new Request(`http://app.test${path}`, {
            method,
            headers,
            body: payload,
        }),
    );
    // biome-ignore lint/suspicious/noExplicitAny: the test reads loose JSON
    const json: any = await response.json();
    return { status: response.status, body: json };
}

describe("expense lifecycle", () => {
    let id: string;

    it("rejects a call without a token", async () => {
        const res = await call("GET", "/expenses/mine");
        assert.equal(res.status, 401);
    });

    it("rejects malformed input before any logic runs", async () => {
        const res = await call("POST", "/expenses", ANNA, {
            description: "Taxi",
            amount_cents: "12",
        });
        assert.equal(res.status, 400);
    });

    it("rejects a non-positive amount as a domain error", async () => {
        const res = await call("POST", "/expenses", ANNA, {
            description: "Taxi",
            amount_cents: 0,
        });
        assert.equal(res.status, 422);
        assert.equal(res.body.error, "InvalidAmount");
    });

    it("lets staff create a draft", async () => {
        const res = await call("POST", "/expenses", ANNA, {
            description: "Taxi",
            amount_cents: 2400,
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.status, "draft");
        assert.equal(res.body.author_id, "m-anna");
        id = res.body.id;
    });

    it("lets only the author submit it", async () => {
        const other = await call("POST", `/expenses/${id}/submit`, BRUNO);
        assert.equal(other.status, 403);
        const res = await call("POST", `/expenses/${id}/submit`, ANNA);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "submitted");
    });

    it("lets only an admin approve it, and mails the author", async () => {
        const staff = await call("POST", `/expenses/${id}/approve`, ANNA);
        assert.equal(staff.status, 403);
        const submitted = await call("GET", "/expenses/submitted", CARLA);
        assert.deepEqual(
            submitted.body.map((e: { id: string }) => e.id),
            [id],
        );
        const res = await call("POST", `/expenses/${id}/approve`, CARLA);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "approved");
        assert.deepEqual(
            (await app.sentMail()).map((m) => m.to),
            ["anna@example.com"],
        );
    });

    it("refuses a transition the state machine does not allow", async () => {
        const res = await call("POST", `/expenses/${id}/approve`, CARLA);
        assert.equal(res.status, 409);
        assert.equal(res.body.error, "InvalidTransition");
    });

    it("reimburses an approved expense", async () => {
        const res = await call("POST", `/expenses/${id}/reimburse`, CARLA);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "reimbursed");
    });

    it("answers 404 for an unknown expense", async () => {
        const res = await call("POST", "/expenses/nope/submit", ANNA);
        assert.equal(res.status, 404);
    });
});

describe("import", () => {
    it("creates every row, or none when one is invalid", async () => {
        const bad = await call(
            "POST",
            "/expenses/import",
            CARLA,
            "description,amount_cents\nHotel,9000\nPranzo,-1\n",
        );
        assert.equal(bad.status, 422);
        const mine = await call("GET", "/expenses/mine", CARLA);
        assert.equal(mine.body.length, 0);

        const ok = await call(
            "POST",
            "/expenses/import",
            CARLA,
            "description,amount_cents\nHotel,9000\nPranzo,1500\n",
        );
        assert.equal(ok.status, 201);
        assert.equal(ok.body.created, 2);
    });

    it("is for admins only", async () => {
        const res = await call(
            "POST",
            "/expenses/import",
            ANNA,
            "description,amount_cents\nHotel,9000\n",
        );
        assert.equal(res.status, 403);
    });
});
