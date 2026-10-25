import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { allowedTool } from "./policy.js";
import { chooseSession, applyControl } from "./controls.js";
import { prepareWorkspace } from "./workspace.js";
import { validateConfig } from "./modes.js";
test("agent file operations stay inside the single classroom fixture", () => {
  const cwd = resolve("classroom");
  assert.equal(
    allowedTool(cwd, "Read", { file_path: "lesson.txt" }, false),
    true,
  );
  assert.equal(allowedTool(cwd, "Read", { file_path: "../.env" }, true), false);
  assert.equal(
    allowedTool(cwd, "Bash", { file_path: "lesson.txt" }, true),
    false,
  );
});
test("writes need explicit capability and a bounded marker", () => {
  const cwd = resolve("classroom"),
    i = { file_path: "lesson.txt", content: "FORK-40\n" };
  assert.equal(allowedTool(cwd, "Write", i, true), true);
  assert.equal(allowedTool(cwd, "Write", i, false), false);
  assert.equal(
    allowedTool(cwd, "Write", { ...i, content: "unbounded replacement" }, true),
    false,
  );
});
test("branch selection is limited to the pending run", async () => {
  const a = new AbortController(),
    p = chooseSession(["original", "fork"], a.signal);
  assert.throws(() => applyControl({ id: p.id, sessionId: "other" }));
  assert.equal(applyControl({ id: p.id, sessionId: "fork" }), true);
  assert.equal(await p.selection, "fork");
  assert.equal(applyControl({ id: p.id, sessionId: "fork" }), false);
});
test("cancelling removes the branch selection capability", async () => {
  const a = new AbortController(),
    p = chooseSession(["fork"], a.signal);
  a.abort();
  await assert.rejects(p.selection, /cancelled/);
  assert.equal(applyControl({ id: p.id, sessionId: "fork" }), false);
});
test("browser cannot supply an arbitrary resume ID or cwd", () => {
  assert.throws(() => validateConfig({ mode: "basic", resume: "other" }));
  assert.throws(() => validateConfig({ mode: "unknown" }));
});
test("real Git worktrees keep file edits separate", async () => {
  const w = await prepareWorkspace(true);
  try {
    await writeFile(join(w.branch, "lesson.txt"), "FORK-40");
    const s = await w.inspect();
    assert.equal(s.files.main, "BASE-40");
    assert.equal(s.files.branch, "FORK-40");
  } finally {
    await w.cleanup();
  }
});
test("application state reloads without copying transcripts", async () => {
  const w = await prepareWorkspace();
  try {
    assert.equal(await w.saveState("JWT-40"), "JWT-40");
    assert.deepEqual((await w.inspect()).transcripts, {
      source: [],
      target: [],
    });
    await assert.rejects(w.transfer("../../outside"), /Invalid session/);
  } finally {
    await w.cleanup();
  }
});
