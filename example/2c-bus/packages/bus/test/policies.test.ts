// Every change to who may call what shows up in the diff of policies.test.ts.snapshot.
import { it } from "node:test";
import { commands } from "@expenses/commands";
import { policies } from "@expenses/core";
import { handlers } from "../src/index.js";

it("command → use case → policy", (t) => {
    const table = Object.keys(commands)
        .sort()
        .map((name) => {
            const { useCase } = handlers[name as keyof typeof handlers];
            return `${name} → ${useCase} → ${policies[useCase].name}`;
        });
    t.assert.snapshot(table);
});
