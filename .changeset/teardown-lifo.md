---
"@efesto-cloud/teardown": patch
---

Run teardown cleanups in last-in/first-out order. Functions now execute in the reverse of their registration order, so resources tear down opposite to how they were set up (HTTP server first, then queues, dependencies, and finally the database). Register cleanups in setup order instead of manually reversing them.
