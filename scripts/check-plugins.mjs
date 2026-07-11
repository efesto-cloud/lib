#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const manifestPath = join(root, ".claude-plugin", "marketplace.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// A plugin is installed as `<name>@<marketplace>`, so the name has to survive
// being an identifier: no whitespace, no separators. Mixed case is fine — `Core`
// and `MongoDB` resolve today. A skill is only discovered at
// `<source>/skills/<skill>/SKILL.md`; a plugin whose skills sit anywhere else
// installs successfully and exposes nothing, which fails silently.
const NAME_RE = /^[A-Za-z0-9._-]+$/;

const errors = [];

for (const plugin of manifest.plugins ?? []) {
    const problems = [];

    if (!NAME_RE.test(plugin.name ?? "")) {
        problems.push(
            `name must contain no whitespace and only [A-Za-z0-9._-] (got "${plugin.name}")`,
        );
    }

    const skillsDir = join(root, plugin.source ?? "", "skills");
    let skills = [];
    try {
        skills = readdirSync(skillsDir).filter((entry) => {
            const skillFile = join(skillsDir, entry, "SKILL.md");
            try {
                return statSync(skillFile).isFile();
            } catch {
                return false;
            }
        });
    } catch {
        problems.push(
            `no \`skills/\` directory at ${plugin.source}/skills — skills are only discovered at <source>/skills/<name>/SKILL.md`,
        );
    }

    if (skills.length === 0 && !problems.some((p) => p.includes("skills/"))) {
        problems.push(`\`${plugin.source}/skills\` contains no */SKILL.md`);
    }

    if (problems.length) errors.push([plugin.name ?? "(unnamed)", problems]);
}

if (errors.length) {
    console.error("check-plugins: found issues\n");
    for (const [name, problems] of errors) {
        console.error(`  ${name}`);
        for (const p of problems) console.error(`    - ${p}`);
    }
    process.exit(1);
}

console.log(`check-plugins: ${manifest.plugins.length} plugins OK`);
