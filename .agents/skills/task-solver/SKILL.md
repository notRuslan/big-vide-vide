---
name: task-solver
description: Implements and verifies a task from the tasks folder. Use when the user wants to solve/complete a task that has been specified in tasks/*.md. Handles reading the task spec, implementing changes, verifying acceptance criteria, and reporting results.
---

# Task Solver

Skill for implementing and verifying a task from the `tasks/` folder. The agent reads the task specification, implements the solution, locally verifies all acceptance criteria, and reports the results to the user.

## When to Use This Skill

Use this skill when the user:
- Says something like "solve task X", "implement task", "complete task X"
- Points to a file in the `tasks/` folder and asks to solve it
- Says "solve this task" and provides a task file path
- Wants to implement an already-specified task
- Asks to run/complete a task from the backlog

## Workflow

Follow this 8-step workflow for every task:

### Step 1: Load the Task

Locate and read the task specification:

1. **Find the task file** — if the user specified a file, use it directly. Otherwise, list `tasks/*.md` and ask which one to solve:
   ```
   Available tasks:
     - tasks/2025-01-15-user-authentication.md
     - tasks/2025-01-16-dark-mode-toggle.md
   Which one should I solve?
   ```
2. **Read the full task spec** — `AGENTS.md`, the task `.md` file, and all referenced source files
3. **Confirm understanding** — summarize what needs to be done and confirm with the user:
   > "Got it. I'll solve task **<TASK_TITLE>**. Summary: [brief recap]. Starting implementation."

### Step 2: Analyze Project Context

Understand the current codebase before making changes:

1. **Read `AGENTS.md`** — architecture, tech stack, API, DB schema, Docker setup
2. **Read referenced files** from the task spec:
   - Backend: `apps/backend/server.js`, `apps/backend/db.js`, `apps/backend/package.json`
   - Frontend: `apps/frontend/src/App.vue`, `apps/frontend/src/main.js`, `apps/frontend/vite.config.js`
   - Infrastructure: `docker-compose.yml`, `Dockerfile`
3. **Identify existing patterns** — coding style, naming conventions, error handling, architecture
4. **Note any conflicts** — existing functionality that could break

Document findings in the task execution log (internal reference, not shown to user).

### Step 3: Implement the Task

Implement all changes specified in the task:

1. **Follow the implementation order** from the task spec (if provided)
2. **Create new files** — exactly as specified in the spec
3. **Modify existing files** — precise, minimal changes; preserve existing patterns
4. **Add dependencies** — update `package.json` only if needed, run `npm install`
5. **Handle edge cases** — validation, error states, loading states
6. **Ensure Docker compatibility** — if the task affects infrastructure, note changes

**Rules:**
- Do NOT modify files outside the task scope
- Do NOT break existing functionality
- Follow existing coding patterns (Composition API, Tailwind, Express routes, etc.)
- If something in the spec is ambiguous, make the most reasonable choice and note it

### Step 4: Verify Acceptance Criteria

Before reporting to the user, verify EVERY acceptance criterion locally:

#### 4.1 Automated Checks

Run the relevant commands based on the task scope:

| Task Type | Verification Commands |
|-----------|----------------------|
| Backend API | `curl` test endpoints, check DB schema |
| Frontend UI | Vite dev build (`npm run build`), check for errors |
| Docker | `docker compose build`, check image builds |
| Full-stack | Both frontend build + backend startup |

**API testing example:**
```bash
# Check existing API works
curl -s http://localhost:3000/api/todos | head -c 500

# Test new endpoint (if applicable)
curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"test123"}'
```

**Build verification:**
```bash
cd apps/frontend && npm run build
# Check for TypeScript errors, compilation warnings

cd apps/backend && node -e "require('./db.js')"
# Check DB initialization works
```

#### 4.2 Manual Criteria Checks

For each acceptance criterion in the task spec, explicitly verify:

```
✅ Criterion 1: User can register — tested via curl, returned 201
❌ Criterion 2: Token stored in localStorage — not testable via CLI, needs browser
✅ Criterion 3: Protected endpoints reject invalid tokens — tested via curl, returned 401
```

**If a criterion CANNOT be verified locally** (e.g., requires browser interaction, visual inspection):
- Note it as `⚠️ Manual check required: <criterion>`
- Provide clear instructions for the user to verify

**If a criterion FAILS:**
- Fix the issue and re-verify
- If unfixable, report honestly to the user with explanation

#### 4.3 Regression Check

Verify nothing existing is broken:
```bash
# Quick smoke test of existing functionality
curl -s http://localhost:3000/api/todos
# Should return existing todos (or empty array)

# Frontend dev server should still start
cd apps/frontend && npm run dev -- --port 3001 &
# Verify no port conflicts, no errors
```

### Step 5: Write Tests for New Functionality

After implementing the task, write tests that cover the new functionality:

1. **Identify what needs testing** — based on the Testing Scenarios defined in the task spec
2. **Write test cases** — for each scenario from Step 4 of task-creator:
   - Happy path
   - Edge cases
   - Error handling
   - Integration with existing features
3. **Run the tests** — execute them and observe results
4. **Fix broken tests** — if a test fails:
   - If the failure is a bug in the implementation → fix the implementation and re-run
   - If the test itself is incorrect → fix the test and re-run
   - Continue until all tests pass
5. **If you don't know how to fix** a failing test:
   - **STOP** and notify the user immediately
   - Explain what failed, why you think it's failing, and what you tried
   - Ask the user for guidance or clarification
   - Do NOT ship unverified functionality

**Rules:**
- Tests must be written in the project's existing testing framework (if any)
- If no testing framework exists, use simple shell scripts / curl commands / browser checks
- All tests must pass before proceeding to Step 6
- Never skip tests even if "everything looks fine" visually

### Step 6: Verify All Tests (Regression)

Before reporting results, run ALL tests — not just the new ones — to ensure nothing is broken:

1. **Run the project's test suite** (if it exists):
   ```bash
   npm run test
   ```
2. **Run manual smoke tests** for existing functionality:
   - Existing API endpoints still work
   - Frontend builds without errors
   - No console errors on page load
   - Existing user flows still function (add task, toggle, delete, etc.)
3. **Fix any regressions** you find:
   - If you discover that an existing feature broke → fix it
   - Re-run all tests after fixing
   - If you don't know how to fix a regression → notify the user (see Step 5 rules)
4. **Only proceed if everything passes** — all new tests AND all existing functionality

### Step 7: Report Results to User

Present a structured report:

```
## Task Completed: <TASK_TITLE>

### What was done
- [List implemented changes with file paths]
- [New files created]
- [Files modified]
- [Dependencies added/updated]

### Verification Results

| # | Acceptance Criterion | Status |
|---|---------------------|--------|
| 1 | <criterion> | ✅ Verified |
| 2 | <criterion> | ⚠️ Manual |
| 3 | <criterion> | ❌ Failed |

### Notes
- Any decisions made (ambiguous choices)
- Known limitations
- Things requiring manual verification
- Docker/build status

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| apps/backend/server.js | Modified | Added auth routes |
| apps/backend/db.js | Modified | Added users table |
| apps/frontend/src/services/auth.js | Created | Auth API service |
```

### Step 8: Archive the Task

After reporting results:

1. **Move the task file** to the `tasks/done/` directory:
   ```bash
   mkdir -p tasks/done
   mv tasks/<task-file>.md tasks/done/<task-file>.md
   ```
2. **Confirm to the user:**
   > "Task file moved to `tasks/done/`. The task is archived."

**Note:** If the user explicitly asks NOT to move the file, respect their request.

## Error Handling

- **If the task is already in `tasks/done/`** — inform the user and ask if they want to re-solve it
- **If the task spec is incomplete** — ask the user for clarification before implementing
- **If implementation breaks existing functionality** — stop, report, and ask the user how to proceed
- **If a dependency conflicts** — try the most compatible version; if unresolved, report to the user
- **If verification takes too long** — report partial results and explain what still needs checking
- **If you cannot fix a failing test** — stop, explain what failed, what you tried, and ask the user for guidance. Do NOT ship unverified work.

## Tips

- **Start small** — implement the minimum viable solution first, then enhance
- **Test incrementally** — verify each step before moving to the next
- **Read before writing** — understand existing patterns before modifying files
- **Be honest about limitations** — if something can't be auto-verified, say so
- **Keep the user informed** — show progress during long implementations
- **Preserve the git state** — don't commit; let the user decide when to commit
