import {
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  copyFile,
} from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const BASE = "BASE-40";
export async function prepareWorkspace(worktrees = false) {
  const parent = resolve(realpathSync.native(tmpdir()), "claude-sdk40"),
    root = resolve(parent, randomUUID());
  const safe = () => {
    const p = relative(parent, root);
    if (!p || p.startsWith("..") || isAbsolute(p))
      throw new Error("Invalid disposable workspace.");
  };
  safe();
  const cwd = join(root, "project"),
    branch = join(root, "branch"),
    target = join(root, "target"),
    home = join(root, "home"),
    sdkHome = join(root, "sdk"),
    targetHome = join(root, "target-home"),
    targetSdk = join(root, "target-sdk");
  for (const p of [
    cwd,
    target,
    home,
    sdkHome,
    targetHome,
    targetSdk,
    join(root, "no-hooks"),
  ])
    await mkdir(p, { recursive: true });
  await writeFile(join(cwd, "lesson.txt"), BASE);
  await writeFile(join(target, "lesson.txt"), BASE);
  if (worktrees) {
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(root, "no-gitconfig"),
    };
    const git = (...args: string[]) =>
      exec("git", ["-c", `core.hooksPath=${join(root, "no-hooks")}`, ...args], {
        cwd,
        env,
      });
    await git("init");
    await git("add", "lesson.txt");
    await git(
      "-c",
      "user.name=Classroom",
      "-c",
      "user.email=classroom@example.invalid",
      "commit",
      "-m",
      "Seed branch fixture",
    );
    await git("worktree", "add", "-b", "classroom-fork", branch);
  } else {
    await mkdir(branch);
    await writeFile(join(branch, "lesson.txt"), BASE);
  }
  async function transcriptFiles(base = sdkHome) {
    const out: string[] = [];
    async function visit(dir: string) {
      for (const p of await readdir(dir, { withFileTypes: true })) {
        const file = join(dir, p.name);
        if (p.isDirectory()) await visit(file);
        else if (p.name.endsWith(".jsonl")) out.push(file);
      }
    }
    await visit(base);
    return out;
  }
  async function transcriptPath(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error("Invalid session identifier.");
    const p = (await transcriptFiles()).find((p) => p.endsWith(id + ".jsonl"));
    if (!p) throw new Error("Source transcript not found.");
    return p;
  }
  return {
    cwd,
    branch,
    target,
    home,
    sdkHome,
    targetHome,
    targetSdk,
    async hash(id: string) {
      return createHash("sha256")
        .update(await readFile(await transcriptPath(id)))
        .digest("hex");
    },
    async transfer(id: string) {
      const source = await transcriptPath(id),
        dir = join(targetSdk, "projects", target.replace(/[^a-zA-Z0-9]/g, "-"));
      await mkdir(dir, { recursive: true });
      await copyFile(source, join(dir, id + ".jsonl"));
    },
    async saveState(text: string) {
      await writeFile(
        join(root, "application-state.json"),
        JSON.stringify({ decision: text }),
      );
      return (
        JSON.parse(
          await readFile(join(root, "application-state.json"), "utf8"),
        ) as { decision: string }
      ).decision;
    },
    async inspect() {
      return {
        files: {
          main: await readFile(join(cwd, "lesson.txt"), "utf8"),
          branch: await readFile(join(branch, "lesson.txt"), "utf8"),
          target: await readFile(join(target, "lesson.txt"), "utf8"),
        },
        transcripts: {
          source: (await transcriptFiles()).map((p) => relative(sdkHome, p)),
          target: (await transcriptFiles(targetSdk)).map((p) =>
            relative(targetSdk, p),
          ),
        },
      };
    },
    async cleanup() {
      safe();
      await rm(root, { recursive: true, force: true });
    },
  };
}
