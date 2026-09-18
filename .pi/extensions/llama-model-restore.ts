/**
 * llama-model-restore
 *
 * After any pi-subagents run completes (foreground or async), make sure the
 * llama.cpp router has the parent session's model loaded again. The router runs
 * with --models-max 1, so loading the parent model evicts the model the subagent
 * used (for example gemma4 after an image-viewer run).
 *
 * Without this, the parent's next request would still trigger the switch, but only
 * when that request is sent; this extension starts the reload immediately.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "llama.cpp";
const DEFAULT_ROUTER_URL = "http://127.0.0.1:8085";
const COMPLETION_EVENTS = ["subagent:async-complete", "subagent:foreground-complete"];

type RouterModel = { id: string; status?: { value?: string } };

export default function (pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let inFlight: Promise<void> | undefined;

  const DEBUG = process.env.LLAMA_RESTORE_DEBUG === "1";
  const debug = (msg: string) => { if (DEBUG) process.stderr.write(`[llama-model-restore] ${msg}
`); };

  // Keep a fresh context reference: the active model can change during a session.
  const remember = async (_event: unknown, c: ExtensionContext) => { ctx = c; };
  pi.on("session_start", remember);
  pi.on("before_agent_start", remember);
  pi.on("agent_start", remember);
  pi.on("turn_start", remember);
  pi.on("model_select", remember);
  pi.on("session_shutdown", async () => { ctx = undefined; });

  async function routerConnection(c: ExtensionContext): Promise<{ base: string; headers: Record<string, string> }> {
    let base = process.env.LLAMA_BASE_URL || DEFAULT_ROUTER_URL;
    const headers: Record<string, string> = {};
    try {
      const resolved: any = await c.modelRegistry.getProviderAuth(PROVIDER);
      const fromEnv = resolved?.env?.LLAMA_BASE_URL;
      const fromAuth = typeof resolved?.auth?.baseUrl === "string" ? resolved.auth.baseUrl.replace(/\/v1\/?$/, "") : undefined;
      base = fromEnv || fromAuth || base;
      if (resolved?.auth?.apiKey) headers.Authorization = `Bearer ${resolved.auth.apiKey}`;
    } catch {
      // fall back to env/default
    }
    return { base: base.replace(/\/+$/, ""), headers };
  }

  async function restoreParentModel(): Promise<void> {
    const c = ctx;
    if (!c?.model) { debug("no session context yet, skipping"); return; }
    if (c.model.provider !== PROVIDER) { debug(`parent model ${c.model.provider}/${c.model.id} is not ${PROVIDER}, skipping`); return; }
    const target = c.model.id;
    const { base, headers } = await routerConnection(c);

    const listRes = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!listRes.ok) return;
    const list = (await listRes.json()) as { data?: RouterModel[] };
    const entry = list.data?.find((m) => m.id === target);
    if (!entry) return;
    const state = entry.status?.value;
    if (state === "loaded" || state === "loading" || state === "sleeping") { debug(`${target} already ${state}`); return; }
    debug(`requesting load of ${target} at ${base}`);

    const loadRes = await fetch(`${base}/models/load`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ model: target }),
      signal: AbortSignal.timeout(10_000),
    });
    if (loadRes.ok) {
      try { c.ui?.notify?.(`llama.cpp: reloading ${target} after subagent`, "info"); } catch { /* headless */ }
    }
  }

  function onSubagentComplete() {
    if (inFlight) return;
    inFlight = restoreParentModel()
      .catch((error) => { debug(`restore failed: ${error instanceof Error ? error.message : String(error)}`); })
      .finally(() => { inFlight = undefined; });
  }

  for (const name of COMPLETION_EVENTS) pi.events.on(name, onSubagentComplete);
}
