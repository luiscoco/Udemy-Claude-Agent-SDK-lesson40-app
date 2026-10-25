import { runWorker } from "./host.js";
import { prepareWorkspace } from "./workspace.js";
import { chooseSession } from "./controls.js";
import { validateConfig, MODES } from "./modes.js";
import type { WorkerRequest } from "./worker.js";
import type {
  RunConfig,
  Mode,
  LabEvent,
  Observation,
  RunResult,
  Catalog,
  Evidence,
} from "./protocol.js";
export { MODES, validateConfig };
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
export const DEFAULT_CONFIG: RunConfig = { mode: "compare" };
const SEED =
  "This is a classroom branch-label exercise, not a production authentication recommendation. Remember shared marker SHARED-40 and design label JWT-40. Reply exactly JWT-40. No tools.";
const FORK =
  "Explore the alternative classroom design label OAUTH-40, replacing the earlier design label only in this conversation. Retain shared marker SHARED-40. Reply exactly OAUTH-40. No tools.";
const RECALL =
  "What is the current classroom design label in this conversation? Reply with its exact label only. No tools.";
const READ =
  "Read lesson.txt once and report its exact marker. No other tools.";
export const PROMPTS: Record<Mode, string> = {
  basic: SEED,
  compare: SEED,
  independent: SEED,
  "shared-files": READ,
  worktrees: READ,
  choice: SEED,
  transfer: SEED,
  state: SEED,
  "no-fork": SEED,
};
export function redact(text: string) {
  for (const s of [
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
  ].filter(Boolean) as string[])
    text = text.split(s).join("[REDACTED]");
  return text.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]");
}
export async function runAgent(
  value: RunConfig,
  emit: (e: LabEvent) => void,
  controller = new AbortController(),
  scripted = false,
) {
  const c = validateConfig(value),
    w = await prepareWorkspace(c.mode === "worktrees"),
    started = Date.now();
  const results: RunResult[] = [],
    initRecords: { pid: number; sessionId: string }[] = [],
    exceptions: string[] = [],
    observations: Observation[] = [];
  let catalog: Catalog = { sessions: [], messages: [] },
    selectedSessionId: string | null = null,
    sourceUnchanged = true,
    appState: string | null = null;
  const env = (target = false) => ({
    ...process.env,
    HOME: target ? w.targetHome : w.home,
    USERPROFILE: target ? w.targetHome : w.home,
    CLAUDE_CONFIG_DIR: target ? w.targetSdk : w.sdkHome,
  });
  const observe = (kind: string, detail: unknown) => {
    const record = {
      sequence: observations.length + 1,
      atMs: Date.now() - started,
      kind,
      detail,
    };
    observations.push(record);
    emit({ type: "observation", record });
  };
  const call = async (
    label: string,
    prompt: string,
    extra: Partial<WorkerRequest> = {},
    target = false,
  ) => {
    const index = results.length + 1;
    observe("query-options", {
      index,
      label,
      prompt,
      resume: extra.resume || null,
      forkSession: extra.forkSession || false,
      cwd: extra.cwd || (target ? w.target : w.cwd),
      storage: target ? "isolated target storage" : "source storage",
    });
    await runWorker(
      { kind: "query", cwd: target ? w.target : w.cwd, prompt, ...extra },
      env(target),
      controller.signal,
      (type, data) => {
        if (type === "result") {
          const record = { ...data, index, label };
          results.push(record);
          emit({ type: "result", record });
        }
        if (type === "init") initRecords.push(data);
        if (type === "answer") emit({ type: "answer", text: redact(data) });
        if (type === "exception") exceptions.push(redact(data));
        observe(type, type === "exception" ? redact(data) : data);
      },
    );
    if (results.length !== index)
      throw new Error(
        "The SDK produced no result. Inspect the setup and actual worker events.",
      );
    return results[index - 1].sessionId;
  };
  const list = async (target = false) => {
    await runWorker(
      { kind: "catalog", cwd: target ? w.target : w.cwd },
      env(target),
      controller.signal,
      (type, data) => {
        if (type === "catalog") catalog = data;
        else observe(type, data);
      },
    );
    emit({ type: "catalog", catalog });
  };
  const fork = async (
    original: string,
    label: string,
    prompt: string,
    extra: Partial<WorkerRequest> = {},
  ) => {
    const before = await w.hash(original);
    const id = await call(label, prompt, {
      resume: original,
      forkSession: true,
      ...extra,
    });
    const unchanged = before === (await w.hash(original));
    sourceUnchanged &&= unchanged;
    observe("source-transcript-check", { original, forked: id, unchanged });
    return id;
  };
  emit({
    type: "options",
    config: c,
    options: {
      model: MODEL,
      storage:
        "Isolated source and target configurations; every query uses a separate Node process",
      maxBudgetUsd: 0.35,
      scriptedControls: scripted,
      transferBoundary:
        "Target host is simulated by a second local directory, not a remote machine",
      cleanup:
        "All classroom files and transcripts are removed after evidence collection.",
    },
  });
  try {
    if (
      ["basic", "compare", "independent", "choice", "no-fork"].includes(c.mode)
    ) {
      const original = await call("Original · JWT", SEED);
      if (c.mode === "no-fork") {
        await call("Resume without fork", FORK, { resume: original });
        await call("Original now changed", RECALL, { resume: original });
      } else {
        const branch = await fork(original, "Fork · OAuth", FORK);
        if (c.mode === "compare" || c.mode === "independent")
          await call("Resume original", RECALL, { resume: original });
        if (c.mode === "independent")
          await call("Resume fork", RECALL, { resume: branch });
        if (c.mode === "choice") {
          await list();
          if (scripted) selectedSessionId = branch;
          else {
            const choice = chooseSession(
              catalog.sessions.map((s) => s.id),
              controller.signal,
            );
            emit({
              type: "choose",
              id: choice.id,
              preferred: branch,
              sessions: catalog.sessions,
            });
            try {
              selectedSessionId = await choice.selection;
            } finally {
              choice.dispose();
            }
          }
          await call("Selected branch", RECALL, { resume: selectedSessionId });
        }
      }
    }
    if (c.mode === "shared-files" || c.mode === "worktrees") {
      const original = await call("Read original file", READ);
      await fork(
        original,
        "Fork writes file",
        "Use Write exactly once on lesson.txt with content exactly FORK-40, then report FORK-40. No other tools.",
        { allowWrite: true, cwd: c.mode === "worktrees" ? w.branch : w.cwd },
      );
      await call(
        "Original reads current disk",
        "The host has performed a forked file Write since the earlier Read. You MUST perform a NEW Read on lesson.txt now to observe current disk state. Do not reuse any previous tool output. Report the exact CURRENT marker. No other tools.",
        { resume: original },
      );
    }
    if (c.mode === "transfer") {
      const original = await call("Source configuration", SEED);
      const before = await w.hash(original);
      await w.transfer(original);
      observe("transcript-copied", {
        sessionId: original,
        target: "second isolated local configuration",
      });
      await call("Resume in local target", RECALL, { resume: original }, true);
      sourceUnchanged = before === (await w.hash(original));
    }
    if (c.mode === "state") {
      await call("Source decision", SEED);
      appState = await w.saveState(results[0].text);
      observe("application-state-reloaded", {
        decision: appState,
        transcriptsCopied: false,
      });
      await call(
        "Fresh target with app state",
        `Application state supplied explicitly: design label ${appState}. Reply with that label only. No tools.`,
        {},
        true,
      );
    }
    await list(c.mode === "transfer" || c.mode === "state");
    const evidence: Evidence = {
      mode: c.mode,
      results,
      initRecords,
      exceptions,
      catalog,
      sourceUnchanged,
      selectedSessionId,
      appState,
      scriptedControls: scripted,
      ...(await w.inspect()),
      observations,
    };
    emit({ type: "evidence", ...evidence });
  } finally {
    await w.cleanup();
  }
}
