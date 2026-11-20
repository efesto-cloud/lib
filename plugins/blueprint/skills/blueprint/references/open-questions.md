# Open on purpose

These are not decided. When a task touches one, do not invent a rule: tell the
human it is open, propose, and record the decision in the project's ADRs.
The material gathered so far is in `efesto-cloud/lib`, branch
`docs/32-skill-blueprint`, folder `docs/superpowers/notes/blueprint/`.

## Authorization

Who may run a use case. What we know: use cases do not authenticate or
authorize; the actor travels in `ExecutionContext` and is used as data (the
author, the approver). The rule of thumb tried so far: if the answer depends on
who the actor is relative to the resource (role, membership, ownership) it is
authorization; if it depends on the resource's state it is domain. One project
applies a policy per use case through the resolver; it is not yet the rule.
Notes: `autorizzazione.md`.

## Extensions

- **Bus**: one way to call a use case between our own components,
  `dispatch(key, input) → Result`, with the channel as a swappable adapter
  (in-process, Workers RPC, internal HTTP). Different from a **gateway**, which
  exposes use cases to the outside in a public protocol (HTTP/JSON, MCP).
- **Shared bootstrap**: the wiring moved into a package used by several
  processes on the same core.

Neither has a settled form yet. Notes: `estensioni.md`.

## Deferred work

Queues, cron, workflows: where consumers run, retries, idempotency, the actor
of a job, whether work without an actor is a use case. Notes: `estensioni.md`.

## Smaller points

- **Shared contract suite** between a port's fake and its real adapter. Today
  fakes do not honour the save contract, which runs only on the real database.
- **Standard Schema**: the principle is independent of zod; the contract's types
  are bound to zod today.
- **Time**: often in the input (`now: z.date()`), sometimes read from the clock
  inside the use case. No rule.
- **Dirty tracking**: a `save` without changes still runs the `UPDATE` and bumps
  `v`. Harmless as long as use cases save only what changes.
- **Value objects**: not used so far; rules live in entities and `core/rule/`.
  Decide on the first real case.
- **Webapp and UI**: duplicated forms across pages are a real problem, outside
  the core's scope.
- **`@efesto-cloud/*` libraries**: this skill does not depend on
  `@efesto-cloud/entity`, `usecase` or `unit-of-work`; the base `Entity`,
  `UseCase` and the Unit of Work live in the project.
