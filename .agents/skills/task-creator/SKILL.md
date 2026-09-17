---
name: task-creator
description: Prepares a complete, implementation-ready task description from a vague idea or requirement. Use when the user wants to plan, specify, or document a new feature, bug fix, or change before starting development. Handles requirements gathering, project context analysis, technical specification, and structured output.
---

# Task Creator

Skill for preparing a comprehensive, implementation-ready task description from a user's idea or requirement.

## When to Use This Skill

Use this skill when the user:
- Says something like "I want to add a feature", "Let me plan task X", "Create a task for..."
- Wants to specify requirements before coding
- Needs to document a change with full context for implementation
- Asks to prepare a task description / specification / plan
- Mentions a feature or bug that needs full documentation before work begins

## Workflow

Follow this 5-step workflow for every task:

### Step 1: Clarify the Goal

Ask the user (if not already clear) to describe:
- **What** they want to build/fix
- **Why** (business/user value)
- **How** it should behave (if they have ideas)

Summarize the goal back to the user for confirmation:
> "Correct me if I'm wrong, but you want [summary]. Is that right?"

### Step 2: Analyze Project Context

Read and understand the project:

1. **Read `AGENTS.md`** — project overview, tech stack, structure, API, database
2. **Read key source files** relevant to the task area:
   - For frontend changes: `apps/frontend/src/App.vue`, `main.js`, `vite.config.js`
   - For backend changes: `apps/backend/server.js`, `db.js`, `package.json`
   - For database changes: `db.js` (schema), `docker-compose.yml` (volumes)
3. **Read `docker-compose.yml`** and **`Dockerfile`** if infrastructure is involved
4. **Identify patterns** — coding style, naming conventions, existing architecture

Document findings as "Current State" in the task description.

### Step 3: Define Requirements

Based on the goal + context, define:

#### Functional Requirements
- What the feature **does** (user-facing behavior)
- Input → Processing → Output flow
- Edge cases and error handling
- Integration with existing features

#### Non-Functional Requirements
- Performance (if relevant)
- Security considerations
- Compatibility / browser support
- Accessibility (if UI)

#### Constraints
- Must work with existing API structure
- Must follow existing coding patterns
- Docker deployment compatibility
- Database schema constraints

### Step 4: Create Technical Specification

Specify the **technical implementation**:

#### Files to Create
- New files with full content/template

#### Files to Modify
- Each file → what changes → why
- Code snippets for key logic

#### API Changes
- New endpoints or modifications to existing ones
- Request/response schemas

#### Database Changes
- New tables/columns or modifications
- Migration notes

#### UI Changes
- New components, pages, or modifications
- Layout/wireframe descriptions

#### Dependencies
- New packages needed (with reasons)
- Version requirements

#### Testing Scenarios
Define the test scenarios that must be verified for this feature:

1. **Happy Path** — the expected, successful user flow
2. **Edge Cases** — empty input, invalid data, concurrent actions, etc.
3. **Error Handling** — what happens on API errors, network failures, invalid states
4. **Integration** — how the new feature interacts with existing features
5. **Regression** — what existing functionality must still work after this change

Each scenario should include:
- **Steps** — step-by-step user actions
- **Expected Result** — what the user/system should observe
- **Priority** — must-have (critical path) or nice-to-have

Example:
```
### Scenario 1: User creates a task
- Steps: Open app → type text → press Enter
- Expected: New task appears in the list, saved to DB, count updates
- Priority: must-have

### Scenario 2: User creates a task with empty text
- Steps: Open app → press Add without typing
- Expected: Nothing happens, no error, no invalid DB entry
- Priority: must-have

### Scenario 3: User deletes a task and restores it (regression)
- Steps: Delete task → refresh page
- Expected: Task is gone from UI and DB
- Priority: must-have
```

### Step 5: Generate Task Description

Output the task description to a file following the template at `templates/task-description-template.md`.

**File naming:** `docs/tasks/YYYY-MM-DD-<task-slug>.md`

If the `docs/tasks/` directory doesn't exist, create it.

## Output Template

Use the template from `templates/task-description-template.md`. Key sections:

1. **Title** — clear, actionable
2. **Status** — `planned` (default)
3. **Created** — date
4. **Goal** — one-sentence summary
5. **Context** — what exists, what changes
6. **Requirements** — functional + non-functional
7. **Technical Spec** — files, API, DB, UI, deps, **testing scenarios**
8. **Acceptance Criteria** — verifiable conditions for "done"
9. **Testing Scenarios** — detailed test cases with steps, expected results, priorities
10. **Implementation Notes** — tips, gotchas, order of operations

## Example Usage

```
User: "I want to add user authentication to the todo app"

Agent loads skill → follows 5 steps → generates:
  docs/tasks/2025-01-15-user-authentication.md

The task doc includes:
  - JWT auth endpoints (POST /api/auth/register, POST /api/auth/login)
  - Protected route middleware
  - localStorage token management on frontend
  - User table in SQLite
  - Login/logout UI on frontend
  - Docker compatibility notes
```

## Tips

- **Be thorough** — a good task description eliminates guesswork
- **Be specific** — "add input validation" → "validate email with regex ^[\\w.%+-]+@[\\w.-]+\\.[a-zA-Z]{2,}$"
- **Consider edge cases** — empty states, error states, loading states
- **Think about Docker** — mention any port, volume, or env var changes
- **Reference existing code** — point to specific files/functions when suggesting modifications
- **Keep it practical** — the task doc should be actionable, not just theoretical
