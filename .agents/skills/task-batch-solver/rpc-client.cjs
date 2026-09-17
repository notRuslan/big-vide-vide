#!/usr/bin/env node
/**
 * RPC Client Helper for task-batch-solver
 *
 * Spawns a pi sub-agent in RPC mode, sends a prompt, waits for agent_settled,
 * and returns the last assistant text.
 *
 * Usage:
 *   node rpc-client.js "<prompt-text>"
 *
 * Output (JSON):
 *   { settled: true/false, lastText: "...", exitCode: 0, duration: 12345 }
 */

const { spawn } = require('child_process');
const readline = require('readline');

const PROMPT = process.argv[2];
if (!PROMPT) {
  console.error('Usage: node rpc-client.js "<prompt>"');
  process.exit(1);
}

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const isWin = process.platform === 'win32';
const agent = spawn(isWin ? 'cmd' : 'pi', isWin ? ['/c', 'pi', '--mode', 'rpc', '--no-session'] : ['--mode', 'rpc', '--no-session'], { shell: isWin });

let buffer = '';
let settled = false;
let lastText = '';
let startTime = Date.now();

function send(cmd) {
  agent.stdin.write(JSON.stringify(cmd) + '\n');
}

function reportAndExit() {
  const duration = Date.now() - startTime;
  const result = JSON.stringify({
    settled,
    lastText: lastText.substring(0, 10000), // truncate for readability
    exitCode: agent.exitCode || 0,
    duration
  });

  if (agent.exitCode !== null && agent.exitCode !== 0 && !settled) {
    process.stderr.write(`Sub-agent exited with code ${agent.exitCode}\n`);
  }

  process.stdout.write(result + '\n');
  process.exit(agent.exitCode === 0 || settled ? 0 : 1);
}

// ---- Read stdout (events from RPC process) ----
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

      // Optional: show progress events
      if (event.type === 'agent_start') {
        process.stderr.write('[sub-agent] agent_start\n');
      }
      if (event.type === 'agent_end') {
        process.stderr.write('[sub-agent] agent_end\n');
      }
    } catch (e) {
      // Not a valid JSON line — ignore
    }
  }
});

agent.stderr.on('data', (data) => {
  // Forward stderr to parent stderr
  process.stderr.write(data);
});

// ---- Read response lines from stdout ----
// We need a second reader for responses (they come on the same stdout stream)
// Use a line-based parser that handles both events and responses
let respBuffer = '';

// Actually, let's use a combined approach: parse every line from stdout
// Events go to the data handler above. We also check if it's a response.
// The issue is that events and responses share stdout.
// Let's restructure: use one handler that checks line type.

// Reset stdout handler to a combined one:
agent.stdout.removeAllListeners('data');

agent.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    let line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line.trim()) continue;

    let event;
    try {
      event = JSON.parse(line);
    } catch (e) {
      continue;
    }

    if (event.type === 'agent_settled') {
      settled = true;
      send({ type: 'get_last_assistant_text' });
    }

    if (event.type === 'response' && event.command === 'get_last_assistant_text') {
      lastText = event.data?.text || '';
      // Abort the sub-agent and exit
      send({ type: 'abort' });
      agent.stdin.end();
      // Give a moment for the abort to process, then exit
      setTimeout(reportAndExit, 200);
    }

    // Progress logging
    if (event.type === 'agent_start') {
      process.stderr.write('[sub-agent] agent_start\n');
    }
    if (event.type === 'agent_end') {
      process.stderr.write('[sub-agent] agent_end\n');
    }
  }
});

// ---- Start: send prompt after brief delay ----
setTimeout(() => {
  send({ type: 'prompt', message: PROMPT });
}, 500);

// ---- Timeout ----
const timeout = setTimeout(() => {
  if (!settled) {
    process.stderr.write(`[sub-agent] TIMEOUT after ${(TIMEOUT_MS / 60000).toFixed(0)} minutes\n`);
    send({ type: 'abort' });
    agent.stdin.end();
    reportAndExit();
  }
}, TIMEOUT_MS);

// ---- Handle process exit ----
agent.on('exit', (code, signal) => {
  if (signal) {
    process.stderr.write(`[sub-agent] killed by signal ${signal}\n`);
  }
  if (!settled && buffer.trim()) {
    // If we got partial output, try to extract last text from message_update events
    // (not ideal, but better than nothing)
    const textDeltas = [];
    const lines = buffer.split('\n');
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'message_update') {
          const delta = ev.assistantMessageEvent;
          if (delta && delta.type === 'text_delta') {
            textDeltas.push(delta.delta);
          }
          if (delta && delta.type === 'text_end') {
            textDeltas.push(delta.content);
          }
        }
      } catch (e) {}
    }
    if (textDeltas.length > 0) {
      lastText = textDeltas.join('');
    }
  }
  clearTimeout(timeout);
  reportAndExit();
});

// Handle SIGINT from parent
process.on('SIGINT', () => {
  process.stderr.write('[sub-agent] interrupted by user\n');
  send({ type: 'abort' });
  agent.stdin.end();
  reportAndExit();
});
