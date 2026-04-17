#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const workspaces = ["packages", "example"];
const manifests = [];
for (const ws of workspaces) {
    const wsPath = join(root, ws);
    if (ws === "example") {
        manifests.push(join(wsPath, "package.json"));
        continue;
    }
    for (const entry of readdirSync(wsPath)) {
        const pkgPath = join(wsPath, entry, "package.json");
        try {
            if (statSync(pkgPath).isFile()) manifests.push(pkgPath);
        } catch {}
    }
}

const allNames = new Set();
for (const file of manifests) {
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    allNames.add(pkg.name);
}

const publicPkgs = [];
const errors = [];

for (const file of manifests) {
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    const rel = file.replace(`${root}/`, "");
    const problems = [];

    if (!pkg.name?.startsWith("@efesto-cloud/")) {
        problems.push(
            `name must start with "@efesto-cloud/" (got "${pkg.name}")`,
        );
    }

    const deps = {
        ...pkg.dependencies,
        ...pkg.peerDependencies,
        ...pkg.devDependencies,
    };
    for (const [dep, range] of Object.entries(deps)) {
        if (
            typeof range === "string" &&
            range.startsWith("workspace:") &&
            !allNames.has(dep)
        ) {
            problems.push(
                `workspace dep "${dep}" does not resolve to a workspace package`,
            );
        }
    }

    if (pkg.private) {
        if (problems.length) errors.push([rel, problems]);
        continue;
    }

    publicPkgs.push({ file: rel, pkg });

    if (pkg.type !== "module") problems.push('missing `"type": "module"`');
    if (!pkg.module && !pkg.main) problems.push("missing `module` or `main`");
    if (!pkg.types) problems.push("missing `types`");
    if (!pkg.exports?.["."]) problems.push('missing `exports["."]`');
    if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
        problems.push('`files` must include "dist"');
    }
    if (pkg.publishConfig?.access !== "public") {
        problems.push('missing `publishConfig.access: "public"`');
    }
    if (pkg.license !== "MIT")
        problems.push(`license must be "MIT" (got "${pkg.license}")`);
    if (!pkg.scripts?.build) problems.push("missing `scripts.build`");

    const expectedRepoUrl = "git+https://github.com/efesto-cloud/lib.git";
    const expectedDir = rel.replace(/\/package\.json$/, "");
    if (!pkg.repository || typeof pkg.repository !== "object") {
        problems.push(
            "missing `repository` object (required for npm provenance)",
        );
    } else {
        if (pkg.repository.type !== "git")
            problems.push('`repository.type` must be "git"');
        if (pkg.repository.url !== expectedRepoUrl)
            problems.push(
                `\`repository.url\` must be "${expectedRepoUrl}" (got "${pkg.repository.url ?? ""}")`,
            );
        if (pkg.repository.directory !== expectedDir)
            problems.push(
                `\`repository.directory\` must be "${expectedDir}" (got "${pkg.repository.directory ?? ""}")`,
            );
    }

    if (problems.length) errors.push([rel, problems]);
}

const versions = new Set(publicPkgs.map(({ pkg }) => pkg.version));
if (versions.size > 1) {
    const list = publicPkgs
        .map(({ pkg, file }) => `  ${pkg.name}@${pkg.version} (${file})`)
        .join("\n");
    errors.push([
        "version drift",
        [
            `fixed versioning expects all public packages at the same version. Found:\n${list}`,
        ],
    ]);
}

if (errors.length) {
    console.error("check-packages: found issues\n");
    for (const [file, problems] of errors) {
        console.error(`  ${file}`);
        for (const p of problems) console.error(`    - ${p}`);
    }
    process.exit(1);
}

console.log(`check-packages: ${publicPkgs.length} public packages OK`);
