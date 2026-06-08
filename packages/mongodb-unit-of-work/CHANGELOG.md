# @efesto-cloud/mongodb-unit-of-work

## 1.0.0

### Major Changes

- af397cc: Rename packages and their exported symbols for clarity and naming consistency. **Breaking:** update imports.

  Package renames:

  - `@efesto-cloud/compute` → `@efesto-cloud/computed` (now matches the `Computed<T>` export and the package directory)
  - `@efesto-cloud/login_session` → `@efesto-cloud/login-session` (kebab-case)
  - `@efesto-cloud/database-context` → `@efesto-cloud/unit-of-work`
  - `@efesto-cloud/mongodb-database-context` → `@efesto-cloud/mongodb-unit-of-work`
  - `@efesto-cloud/prisma-database-context` → `@efesto-cloud/prisma-unit-of-work`
  - `@efesto-cloud/population` → `@efesto-cloud/expand`
  - `@efesto-cloud/mongodb-population` → `@efesto-cloud/mongodb-expand`
  - `@efesto-cloud/prisma-population` → `@efesto-cloud/prisma-expand`

  Symbol renames:

  - `IDatabaseContext` → `IUnitOfWork`
  - `MongoDBContext` / `IMongoDBContext` → `MongoDBUnitOfWork` / `IMongoDBUnitOfWork`
  - `PrismaContext` / `IPrismaContext` → `PrismaUnitOfWork` / `IPrismaUnitOfWork`
  - `Populate` → `Expand`, `NormalizedPopulate` → `NormalizedExpand`, `normalizePopulate` → `normalizeExpand`
  - `BasePopulator` → `BaseExpander` (with `markPopulated`/`isPopulated`/`populate()` → `markExpanded`/`isExpanded`/`expand()`, and `QueryBuilder`'s protected `populate`/`push_populate_pipeline` → `expand`/`push_expand_pipeline`)
  - `BasePrismaPopulator` → `BasePrismaExpander`

### Patch Changes

- Updated dependencies [af397cc]
  - @efesto-cloud/unit-of-work@1.0.0

## 0.0.4

### Patch Changes

- 9e6ed47: Added Knip checks and improved exports/entrypoints of packages
- Updated dependencies [9e6ed47]
  - @efesto-cloud/database-context@0.0.4

## 0.0.3

### Patch Changes

- 5faeeb2: Added Documentation
- Updated dependencies [5faeeb2]
  - @efesto-cloud/database-context@0.0.3

## 0.0.2

### Patch Changes

- 2756f8c: Prova 0.0.2
- Updated dependencies [2756f8c]
  - @efesto-cloud/database-context@0.0.2
  - @efesto-cloud/usecase@0.0.2
