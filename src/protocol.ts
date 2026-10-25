export const MODES = [
  "basic",
  "compare",
  "independent",
  "shared-files",
  "worktrees",
  "choice",
  "transfer",
  "state",
  "no-fork",
] as const;
export type Mode = (typeof MODES)[number];
export interface RunConfig {
  mode: Mode;
}
export interface RunResult {
  index: number;
  label: string;
  pid: number;
  sessionId: string;
  status: string;
  text: string;
  costUsd: number;
}
export interface Observation {
  sequence: number;
  atMs: number;
  kind: string;
  detail: unknown;
}
export interface Catalog {
  sessions: { id: string; title: string }[];
  messages: { sessionId: string; messages: unknown[] }[];
}
export interface Evidence {
  mode: Mode;
  results: RunResult[];
  initRecords: { pid: number; sessionId: string }[];
  exceptions: string[];
  catalog: Catalog;
  sourceUnchanged: boolean;
  selectedSessionId: string | null;
  files: { main: string; branch: string; target: string };
  transcripts: { source: string[]; target: string[] };
  appState: string | null;
  scriptedControls: boolean;
  observations: Observation[];
}
export type LabEvent =
  | { type: "options"; config: RunConfig; options: unknown }
  | { type: "observation"; record: Observation }
  | { type: "result"; record: RunResult }
  | { type: "catalog"; catalog: Catalog }
  | {
      type: "choose";
      id: string;
      preferred: string;
      sessions: Catalog["sessions"];
    }
  | { type: "answer"; text: string }
  | ({ type: "evidence" } & Evidence)
  | { type: "error" | "notice"; text: string };
