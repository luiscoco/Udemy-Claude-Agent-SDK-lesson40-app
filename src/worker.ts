import {
  query,
  listSessions,
  getSessionMessages,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "node:readline";
import { allowedTool } from "./policy.js";
export interface WorkerRequest {
  kind: "query" | "catalog";
  cwd: string;
  prompt?: string;
  resume?: string;
  continue?: boolean;
  forkSession?: boolean;
  persistSession?: boolean;
  maxTurns?: number;
  allowWrite?: boolean;
}
const controller = new AbortController(),
  input = createInterface({ input: process.stdin });
const request = await new Promise<WorkerRequest>((resolve) =>
  input.once("line", (line) => resolve(JSON.parse(line))),
);
input.on("line", () => controller.abort());
const send = (type: string, value: unknown) =>
  process.stdout.write(JSON.stringify({ type, value }) + "\n");
try {
  if (request.kind === "catalog") {
    const sessions = await listSessions({
      dir: request.cwd,
      includeWorktrees: false,
      limit: 20,
    });
    const messages = [];
    for (const s of sessions)
      messages.push({
        sessionId: s.sessionId,
        messages: await getSessionMessages(s.sessionId, {
          dir: request.cwd,
          limit: 60,
        }),
      });
    send("catalog", {
      sessions: sessions.map((s) => ({
        id: s.sessionId,
        title: s.customTitle || s.summary || s.firstPrompt || s.sessionId,
      })),
      messages,
    });
  } else {
    const options: Options = {
      cwd: request.cwd,
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      tools: request.allowWrite ? ["Read", "Write"] : ["Read"],
      allowedTools: request.allowWrite ? ["Read", "Write"] : ["Read"],
      permissionMode: "dontAsk",
      settingSources: [],
      plugins: [],
      persistSession: request.persistSession ?? true,
      maxTurns: request.maxTurns ?? 4,
      maxBudgetUsd: 0.35,
      effort: "low",
      thinking: { type: "disabled" },
      abortController: controller,
      resume: request.resume,
      continue: request.continue,
      forkSession: request.forkSession,
      env: {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: undefined,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      },
      hooks: {
        PreToolUse: [
          {
            hooks: [
              async (i) => {
                if (i.hook_event_name !== "PreToolUse") return {};
                if (
                  allowedTool(
                    request.cwd,
                    i.tool_name,
                    i.tool_input,
                    request.allowWrite === true,
                  )
                )
                  return {};

                return {
                  hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason:
                      "Only the fixed classroom lesson.txt Read or bounded branch Write is permitted.",
                  },
                };
              },
            ],
          },
        ],
      },
    };
    try {
      const active = query({ prompt: request.prompt!, options });
      for await (const message of active) {
        if (message.type === "system" && message.subtype === "init")
          send("init", { pid: process.pid, sessionId: message.session_id });
        if (message.type === "assistant")
          for (const b of message.message.content) {
            if (b.type === "text") send("answer", b.text);
            else if (b.type === "tool_use") send("tool", b);
          }
        if (message.type === "result")
          send("result", {
            pid: process.pid,
            sessionId: message.session_id,
            status: message.subtype,
            text:
              message.subtype === "success"
                ? message.result
                : message.errors.join("\n"),
            costUsd: message.total_cost_usd,
          });
      }
    } catch (e) {
      send("exception", e instanceof Error ? e.message : String(e));
    }
  }
} catch (e) {
  send("exception", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  input.close();
  process.stdin.destroy();
}
