// Every change to who may call what shows up in the diff of policies.test.ts.snapshot.
import { it } from "node:test";
import { useCases } from "@expenses/contract/registry";
import { policies } from "../src/auth/policies.js";

it("use case → policy", (t) => {
    const table = Object.keys(useCases)
        .sort()
        .map(
            (key) => `${key} → ${policies[key as keyof typeof useCases].name}`,
        );
    t.assert.snapshot(table);
});
