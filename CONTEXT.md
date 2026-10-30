# Efesto blueprint

The vocabulary of how Efesto builds an application: the shapes a project takes as it grows, and the parts that make up each shape. The `blueprint` skill and the `@efesto-cloud/*` libraries use these words with these meanings.

## Growth

**Rung**:
One of the shapes a project can take — 0, 1, 2·A, 2·B, 2·C — each adding packages to the one before.
_Avoid_: level, stage, tier

**Signal**:
The concrete need that justifies climbing to the next rung.
_Avoid_: trigger, reason

**Move**:
The refactor that takes a project from one rung to the next without rewriting it.
_Avoid_: migration, upgrade

## Core and its edges

**Core**:
The package holding entities, value objects, use cases and ports, with no knowledge of any technology.
_Avoid_: domain package, backend

**Use case**:
One business operation: takes an input object and an execution context, returns a Result.
_Avoid_: service, interactor, action

**Execution context**:
What a use case receives besides its input — at least the actor.
_Avoid_: request, session

**Actor**:
Who is performing the operation, as the core knows them.
_Avoid_: user, caller, principal

**Port**:
An interface in the core for anything outside the process: storage, mail, queue, clock, token signer.
_Avoid_: gateway, provider

**Adapter**:
A package that implements one or more ports with a concrete technology.
_Avoid_: driver, plugin, infrastructure

**Stub**:
The in-memory adapter that implements every port, used for mock mode and for tests.
_Avoid_: fake, mock adapter

**Bootstrap**:
The package that loads the core and chooses its adapters, real or stub, for a deployable.
_Avoid_: container, composition package

**Profile**:
A variant of the bootstrap that loads only the adapters one deployable needs.
_Avoid_: preset, flavour

**Policy**:
The rule that says whether an actor may perform a use case on a given input.
_Avoid_: permission, guard, ACL

## Command bus

**Command**:
The contract for one exposed use case: input and output schemas, kind, description, policy.
_Avoid_: operation, endpoint, RPC method

**Handler**:
The code that turns a command into a call to its use case.
_Avoid_: operation, resolver, controller

**Middleware**:
A layer wrapped around every handler, such as policy enforcement, audit or logging.
_Avoid_: decorator, interceptor

**Channel**:
How a command travels from the caller to the bus and its result comes back: in-process, HTTP, RPC.
_Avoid_: transport, protocol

**Bus server**:
The deployable that hosts the bus, its handlers and the bootstrap.
_Avoid_: API worker, API server

## Deferred work

**Job queue**:
The port through which work is scheduled to run later, outside the call that requested it.
_Avoid_: bus, outbox

**Consumer**:
The process that takes jobs from the queue and runs their use cases.
_Avoid_: worker
