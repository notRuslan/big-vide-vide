---
name: task-batch-solver
description: Solves all tasks from the tasks/ folder sequentially through sub-agents. Use when the user wants to solve/complete all pending tasks in batch mode — one by one, with git commits after each successful task and archiving to tasks/done/. Handles sub-agent spawning, context transfer, verification, and task archiving.
---

# Task Batch Solver

Skill for solving **all pending tasks** from the `tasks/` folder in batch mode. Each task is solved sequentially by a dedicated sub-agent (RPC process), with git commit after each success and archiving to `tasks/done/`.

## When to Use This Skill

Use this skill when the user:
- Says "solve all tasks", "run all tasks in batch", "solve the full backlog"
- Wants to process the entire `tasks/` folder automatically
- Asks to "batch solve" or "process all tasks"

## Prerequisites

1. The project must have a `.git` directory (for commits)
2. `pi` CLI must be available in PATH
3. Dependencies must be installed (`npm run install:all`)
4. At least one LLM model must be configured

## Workflow

Follow this workflow for every task in the batch:

### Overview

```
for each task in tasks/*.md:
  1. Read task spec + project context
  2. Spawn sub-agent (RPC process) with full context
  3. Wait for sub-agent to settle (agent_settled event)
  4. Check results (last assistant text + git diff)
  5. If successful → run tests → git commit → mv to tasks/done/
  6. If failed → report and stop the batch
```

### Step 1: Scan for Pending Tasks

List all `.md` files in `tasks/` excluding `tasks/done/`:

```bash
ls tasks/*.md 2>/dev/null | grep -v tasks/done/
```

If no tasks found, report:
> "No pending tasks found in `tasks/`. All tasks are already completed or the folder is empty."

If tasks found, list them for the user:
```
Found N pending tasks:
  1. tasks/task-1-title.md
  2. tasks/task-2-title.md
  ...

Starting batch solve. Processing tasks sequentially...
```

### Step 2: For Each Task — Prepare Context

Before spawning a sub-agent, read and assemble the context:

1. **Read the task file** — the full task spec from `tasks/<task>.md`
2. **Read AGENTS.md** — project architecture, tech stack, API, DB schema
3. **Read referenced source files** — based on what the task spec references
4. **Read existing test files** (if any) — to understand testing patterns

This assembled context will be the prompt for the sub-agent.

### Step 3: Spawn Sub-Agent (RPC Process)

Spawn a new `pi` process in RPC mode with `--no-session` (ephemeral, no state leak between tasks):

```bash
pi --mode rpc --no-session --name "task-solver:<task-name>"
```

The sub-agent will use the same model as the current session (pi inherits provider/model config).

**Important:** Use the helper script to manage RPC communication:

```bash
node .agents/skills/task-batch-solver/rpc-client.js <prompt>
```

The helper script:
- Spawns `pi --mode rpc --no-session`
- Sends the prompt
- Reads events until `agent_settled`
- Returns the last assistant text + exit status

If the helper script doesn't exist, instruct the agent to implement it inline using the RPC protocol (see Appendix A for protocol details).

### Step 4: Wait for Sub-Agent Settlement

The sub-agent runs until `agent_settled` event is received. This means:
- All tool calls completed
- No automatic retry pending
- No queued follow-up messages
- The agent is idle

Monitor for these events on stdout:
- `agent_start` — sub-agent started
- `agent_end` — low-level run completed (may still retry)
- `agent_settled` — fully settled, safe to check results

Wait for `agent_settled` before proceeding.

### Step 5: Check Results

After settlement, check the result:

#### 5.1 Get Last Assistant Text

```json
{"type": "get_last_assistant_text"}
```

Parse the response for the assistant's final message text.

#### 5.2 Analyze Results

Look for indicators of success/failure in the assistant text:
- **Success indicators**: "Task Completed", "All criteria verified", "Tests passed", "Implementation complete"
- **Failure indicators**: "I cannot fix", "Stopped", "Error:", "Failed", "Cannot implement"

#### 5.3 Git Diff Check

Check what files were changed by the sub-agent:

```bash
git diff --stat
```

If no changes — the task was not implemented (likely failed).

### Step 6: Run Tests

If the task appears successfully implemented:

1. **Run project tests**:
   ```bash
   npm run test
   ```
   Or project-specific test commands (see AGENTS.md).

2. **Smoke test existing functionality**:
   ```bash
   # Backend
   curl -s http://localhost:3000/api/todos
   # Frontend build
   cd apps/frontend && npm run build
   ```

3. **Check for regressions** — any existing feature that broke.

If tests fail:
- Try to fix (limited effort — 2-3 attempts max)
- If still failing → report failure and STOP the batch
- Do NOT commit broken code

### Step 7: Git Commit

If all tests pass and implementation is verified:

```bash
cd <project-root>
git add -A
git commit -m "feat: implement <task-name> — <one-line summary>"
```

The commit message should include:
- `feat:` prefix (or `fix:` for bug fixes)
- Task name from the task file
- Brief description of what was implemented

**Do NOT push.** The user controls when to push.

### Step 8: Archive Task

Move the task file to `tasks/done/`:

```bash
mkdir -p tasks/done
mv tasks/<task-file>.md tasks/done/<task-file>.md
```

Confirm to user:
> "Task completed and archived: `tasks/done/<task-file>.md`"

### Step 9: Report Batch Progress

After each successful task, show progress:

```
✅ Task 1/3: <task-name> — COMPLETED
   Files changed: server.js, App.vue
   Tests: all passed
   Committed: abc123

────────────────────────────────
Proceeding to next task...
```

After all tasks are done, show final summary:

```
## Batch Solve Complete

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | task-1.md | ✅ Done | abc123 |
| 2 | task-2.md | ✅ Done | def456 |
| 3 | task-3.md | ❌ Failed | — |

Total: 3 tasks | Success: 2 | Failed: 1
```

## Error Handling

| Scenario | Action |
|----------|--------|
| No pending tasks | Report and exit |
| Sub-agent crashes / exits with error | Report failure, STOP batch |
| Tests fail after implementation | Try fix (2-3 attempts), if still failing → report, STOP batch |
| Regression found | Stop batch, report regression, ask user how to proceed |
| Task spec is ambiguous | Report to user, STOP batch |
| Git not available | Report, STOP batch |
| Disk full / resource error | Report, STOP batch |
| User cancels (Ctrl+C) | Abort current task, report partial progress |

## Progress Tracking

Maintain an internal progress log:

```
=== Batch Solve Log ===
Started: <timestamp>
Tasks found: N

[1/3] task-1.md — spawning sub-agent...
[1/3] task-1.md — sub-agent settled, checking results...
[1/3] task-1.md — tests passed, committing...
[1/3] task-1.md — ✅ DONE, archived to tasks/done/

[2/3] task-2.md — spawning sub-agent...
...

Completed: <timestamp>
```

Share progress updates with the user periodically.

## Context Assembly for Sub-Agent

The prompt sent to each sub-agent should include:

```
=== PROJECT CONTEXT ===
<full content of AGENTS.md>

=== TASK SPECIFICATION ===
<full content of the task .md file>

=== IMPLEMENTATION INSTRUCTIONS ===
Please implement this task completely. Follow this workflow:
1. Read and understand the project context above
2. Implement all changes specified in the task
3. Verify every acceptance criterion locally
4. Write tests for new functionality
5. Run all tests (new + existing) to check for regressions
6. Report results in a structured format

After you finish, I will check your results, run tests, commit changes, and archive the task.
```

For tasks that reference specific source files, include their content in the context:

```
=== REFERENCED FILES ===

File: apps/backend/server.js
```
<content>
```

File: apps/frontend/src/App.vue
```
<content>
```

## Tips

- **One task at a time** — never run two sub-agents in parallel
- **Clean state** — use `--no-session` for each sub-agent to avoid context bleed
- **Commits are atomic** — each task gets its own commit, never batch commits
- **Tests are mandatory** — never skip tests even if everything "looks fine"
- **Stop on failure** — one failure stops the entire batch; don't continue with broken state
- **Preserve user control** — the user can cancel the batch at any time with Ctrl+C
- **Report progress** — show what's happening after each step so the user isn't waiting blind

## Appendix A: RPC Protocol Quick Reference

For implementing the RPC client manually (if helper script is unavailable):

### Spawning
```bash
pi --mode rpc --no-session --name "task-solver:task-name"
```

### Sending Prompt
```json
{"type": "prompt", "message": "<assembled-context>"}
```

### Waiting for Settlement
Read stdout until you see:
```json
{"type": "agent_settled"}
```

### Getting Results
```json
{"type": "get_last_assistant_text"}
```

Response:
```json
{"type": "response", "command": "get_last_assistant_text", "success": true, "data": {"text": "..."}}
```

### Aborting
```json
{"type": "abort"}
```

### Events to Watch
| Event | Meaning |
|-------|---------|
| `agent_start` | Processing began |
| `agent_end` | Run completed (may retry) |
| `agent_settled` | Fully settled — safe to check results |
| `message_update` | Streaming text (assemble for display) |
| `tool_execution_start/end` | Tool call lifecycle |

## Appendix B: rpc-client.js Helper Script

The skill expects a helper script at `.agents/skills/task-batch-solver/rpc-client.js`. If it doesn't exist, the agent should create it. See the example implementation below:

```javascript
// .agents/skills/task-batch-solver/rpc-client.js
// Usage: node rpc-client.js "<prompt-text>"

const { spawn } = require('child_process');
const readline = require('readline');

const PROMPT = process.argv[2];
if (!PROMPT) {
  console.error('Usage: node rpc-client.js "<prompt>"');
  process.exit(1);
}

const agent = spawn('pi', ['--mode', 'rpc', '--no-session']);

let buffer = '';
let settled = false;
let lastText = '';

// Read stdout (events)
agent.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    let line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      if (event.type === 'agent_settled') {
        settled = true;
        // Request last assistant text
        send({ type: 'get_last_assistant_text' });
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
});

agent.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Send stdin (commands)
function send(cmd) {
  agent.stdin.write(JSON.stringify(cmd) + '\n');
}

// Read responses
const respReader = readline.createInterface({ input: agent.stdout });
respReader.on('line', (line) => {
  try {
    const resp = JSON.parse(line);
    if (resp.type === 'response' && resp.command === 'get_last_assistant_text') {
      lastText = resp.data?.text || '';
      respReader.close();
      agent.stdin.write(JSON.stringify({ type: 'abort' }) + '\n');
      agent.stdin.end();
    }
  } catch (e) {
    // Ignore non-response lines
  }
});

// Send prompt after small delay (allow process to start)
setTimeout(() => {
  send({ type: 'prompt', message: PROMPT });
}, 500);

// Timeout: 30 minutes
setTimeout(() => {
  if (!settled) {
    send({ type: 'abort' });
    agent.stdin.end();
    console.error('TIMEOUT: sub-agent did not settle within 30 minutes');
    process.exit(2);
  }
}, 30 * 60 * 1000);

// On exit
agent.on('exit', (code) => {
  console.log(JSON.stringify({
    settled,
    lastText,
    exitCode: code,
    duration: Date.now()
  }));
});
```
