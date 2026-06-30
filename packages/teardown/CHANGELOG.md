# @efesto-cloud/teardown

## 0.0.5

### Patch Changes

- 358b43b: Run teardown cleanups in last-in/first-out order. Functions now execute in the reverse of their registration order, so resources tear down opposite to how they were set up (HTTP server first, then queues, dependencies, and finally the database). Register cleanups in setup order instead of manually reversing them.

## 0.0.4

### Patch Changes

- 9e6ed47: Added Knip checks and improved exports/entrypoints of packages

## 0.0.3

### Patch Changes

- 5faeeb2: Added Documentation

## 0.0.2

### Patch Changes

- 2756f8c: Prova 0.0.2
