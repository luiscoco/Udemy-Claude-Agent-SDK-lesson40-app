# Claude Agent SDK · Lesson 40 · Forking sessions

Five linked student pages, large text, actual SDK experiments and coloured code in all thirteen UML steps.

## What you will learn

- Fork the conversation: Use resume together with forkSession: true to copy history into a new session. Capture the new native system/init session_id.
- Compare independent branches: The original retains classroom label JWT-40 while its fork explores OAUTH-40. These are teaching labels, not authentication design advice.
- Resume either branch: Choose a known original or fork ID from the actual SDK catalog. Each query uses a separate real Node worker process.
- Understand the file boundary: Forking does not copy or restore files. In one directory, a forked Write changes the same lesson.txt that the original later reads.
- Isolate work with Git worktrees: The host creates an actual temporary Git repository and worktree. A fork in the worktree changes only its copy of lesson.txt.
- Plan cross-host state: Compare copying the actual JSONL transcript into a second local SDK configuration with supplying explicit app state to a fresh session. No remote host is provisioned.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson40-app.git
cd .\Udemy-Claude-Agent-SDK-lesson40-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations use `cd .\agent-sdk\lesson40-forking`. Open http://127.0.0.1:3140 and keep the terminal running. Node.js 24+, API credit and model access are required. Windows may require Git Bash.

## Create your .env file

Preserve an existing file. Enter your own model key, then restart. Existing shell values take precedence.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3140
# Windows only, if needed:
# CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe

```

No GitHub token or Managed Agents IDs are required. Secrets, dependencies and teaching media stay outside Git.

## Run the experiments

### Fork and compare

Run Basic, Compare and Independent. Compare native init/result IDs and responses. Original JWT-40 and fork OAUTH-40 are classroom labels only. In Choice inspect either actual transcript, select a branch, then click Resume selected session.

```powershell
npm run sample:env -- basic
npm run sample:env -- compare
npm run sample:env -- independent
npm run sample:env -- choice
```

### Check file isolation

Shared-files writes the same lesson.txt and the original performs a NEW Read. Worktrees repeats the test with an actual separate Git worktree. Compare main and branch markers. Only the fixed classroom fixture can be written.

```powershell
npm run sample:env -- shared-files
npm run sample:env -- worktrees
```

### Compare state transfer strategies

Transfer copies the real JSONL into another LOCAL SDK configuration and resumes the same ID. State supplies explicit JSON app state to a fresh target session. No-fork shows a plain resume changing the original. CLI Choice automatically selects the fork; the web requires your click.

```powershell
npm run sample:env -- transfer
npm run sample:env -- state
npm run sample:env -- no-fork
npm test
```

## How the app was built

### 1. Validate the chosen experiment

Accept only the nine fixed classroom modes. The browser cannot supply arbitrary session IDs, directories or SDK options.

Source: `src/modes.ts`, selected lines 3–9. Surrounding code omitted.

```typescript
export function validateConfig(value: unknown): RunConfig {
  const c = value as Record<string, unknown>;
  if (!c || typeof c !== "object" || !MODES.includes(c.mode as never))
    throw new Error("Choose a listed fork experiment.");
  if (Object.keys(c).some((k) => k !== "mode"))
    throw new Error("Only the classroom mode can be configured here.");
  return { mode: c.mode as RunConfig["mode"] };
```

### 2. Launch an independent SDK process

Every query runs in its own real Node process. Persisted conversation history connects the independent calls.

Source: `src/host.ts`, selected lines 12–19. Surrounding code omitted.

```typescript
const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("./worker.ts", import.meta.url)),
      ],
      { env, stdio: ["pipe", "pipe", "pipe"] },
```

### 3. Set resume and forkSession

Pass the original identifier with forkSession true to the SDK. The other modes can resume the original or the new branch explicitly.

Source: `src/worker.ts`, selected lines 66–68. Surrounding code omitted.

```typescript
resume: request.resume,
      continue: request.continue,
      forkSession: request.forkSession,
```

### 4. Capture the new native init ID

Capture session_id from the actual system/init message. Native result IDs provide a second identity check.

Source: `src/worker.ts`, selected lines 107–113. Surrounding code omitted.

```typescript
if (message.type === "system" && message.subtype === "init")
          send("init", { pid: process.pid, sessionId: message.session_id });
        if (message.type === "assistant")
          for (const b of message.message.content) {
            if (b.type === "text") send("answer", b.text);
            else if (b.type === "tool_use") send("tool", b);
          }
```

### 5. Check the original transcript

Hash the source JSONL before and after creating the fork, before any later original resume appends new messages.

Source: `src/agent.ts`, selected lines 134–142. Surrounding code omitted.

```typescript
const before = await w.hash(original);
    const id = await call(label, prompt, {
      resume: original,
      forkSession: true,
      ...extra,
    });
    const unchanged = before === (await w.hash(original));
    sourceUnchanged &&= unchanged;
    observe("source-transcript-check", { original, forked: id, unchanged });
```

### 6. Resume the original independently

The original still recalls JWT-40; the fork recalls OAUTH-40. Each subsequent resume selects its own explicit ID.

Source: `src/agent.ts`, selected lines 170–174. Surrounding code omitted.

```typescript
if (c.mode === "compare" || c.mode === "independent")
          await call("Resume original", RECALL, { resume: original });
        if (c.mode === "independent")
          await call("Resume fork", RECALL, { resume: branch });
        if (c.mode === "choice") {
```

### 7. Show branch results side by side

Create browser cards from actual SDK responses and render Markdown safely with the shared sanitizer.

Source: `src/client.ts`, selected lines 83–90. Surrounding code omitted.

```typescript
const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = "session_id: " + e.record.sessionId;
    const text = document.createElement("div");
    renderMarkdown(text, e.record.text);
    card.append(title, meta, text);
    get("branch-cards").append(card);
    json("latest-result", e.record);
```

### 8. Limit real file tools

Permit only lesson.txt in the current classroom directory. Writes additionally require the explicit mode capability and a bounded marker.

Source: `src/policy.ts`, selected lines 15–22. Surrounding code omitted.

```typescript
if (name === "Read") return true;
  return (
    name === "Write" &&
    allowWrite &&
    typeof i.content === "string" &&
    i.content.length <= 32 &&
    ["FORK-40", "JWT-40", "OAUTH-40"].includes(i.content.trim())
  );
```

### 9. Create a real Git worktree

Use a distinct Git worktree directory for the fork. Conversation forking alone cannot isolate file changes.

Source: `src/workspace.ts`, selected lines 69–73. Surrounding code omitted.

```typescript
await git("worktree", "add", "-b", "classroom-fork", branch);
  } else {
    await mkdir(branch);
    await writeFile(join(branch, "lesson.txt"), BASE);
  }
```

### 10. Copy the actual saved transcript

Copy the known source JSONL into a second local configuration. This is a same-machine simulation of a host transfer, not a remote deployment.

Source: `src/workspace.ts`, selected lines 106–111. Surrounding code omitted.

```typescript
async transfer(id: string) {
      const source = await transcriptPath(id),
        dir = join(targetSdk, "projects", target.replace(/[^a-zA-Z0-9]/g, "-"));
      await mkdir(dir, { recursive: true });
      await copyFile(source, join(dir, id + ".jsonl"));
    },
```

### 11. Reload explicit application state

Write and reload a small JSON decision record. A fresh target query receives this state explicitly instead of a copied conversation.

Source: `src/workspace.ts`, selected lines 112–119. Surrounding code omitted.

```typescript
async saveState(text: string) {
      await writeFile(
        join(root, "application-state.json"),
        JSON.stringify({ decision: text }),
      );
      return (
        JSON.parse(
          await readFile(join(root, "application-state.json"), "utf8"),
```

### 12. Authorize a known branch selection

A run capability accepts only known session IDs and expires after two minutes. A session identifier alone is not access control.

Source: `src/controls.ts`, selected lines 39–45. Surrounding code omitted.

```typescript
const p = pending.get(c.id);
  if (!p) return false;
  if (!p.ids.has(c.sessionId))
    throw new Error("Select a session listed for this classroom run.");
  p.resolve(c.sessionId);
  return true;
}
```

### 13. Inspect the native session transcript

Render actual getSessionMessages content for the selected original or fork without invoking the model.

Source: `src/client.ts`, selected lines 17–20. Surrounding code omitted.

```typescript
function preview() {
  const entry = catalog.messages.find((s) => s.sessionId === picker.value);
  json("messages", entry || {});
}
```

## Reference topics and limits

- Fork versus resume: resume plus forkSession true creates a new ID with inherited history. Plain resume appends to the same conversation. The No-fork experiment makes the contrast observable.
- Original transcript verification: The source hash is checked immediately after forking, before the next original query. Resuming the original normally appends to its transcript.
- Conversation is not a file snapshot: Both branches using one cwd see the same filesystem. The shared-file test performs an actual forked Write followed by a new original Read. Separate Git worktrees isolate the files.
- Transfer scope: The transfer test copies a real JSONL between two isolated local configurations. It does not provision a remote server or demonstrate SessionStore. Cross-host SessionStore is the next lesson.
- Explicit state alternative: The State test saves an actual result to JSON, reloads it and places that decision in a fresh target prompt. It preserves app-selected information, not the entire conversation.
- Classroom scope and cost: JWT-40 and OAUTH-40 are labels, not security guidance. Read/Write are scoped to one fixture; no model shell or subagents. Git runs in the host. $0.35 is an SDK threshold per query, not a prepaid account cap.
- Storage lifetime: Each classroom run has isolated home and SDK config directories. They are cleaned up after evidence collection. Use a durable and authorized session store in a real multi-user app.

## References

- [Official SDK session documentation](https://code.claude.com/docs/en/agent-sdk/sessions)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Regenerate student pages with `python scripts/build-pages.py`. Run `npm test` for offline boundaries, review lifecycle, workspace and startup checks.
