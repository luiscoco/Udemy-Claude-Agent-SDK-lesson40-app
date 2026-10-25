import { resolve } from "node:path";
export function allowedTool(
  cwd: string,
  name: string,
  value: unknown,
  allowWrite: boolean,
) {
  if (!value || typeof value !== "object") return false;
  const i = value as Record<string, unknown>;
  if (
    typeof i.file_path !== "string" ||
    resolve(cwd, i.file_path) !== resolve(cwd, "lesson.txt")
  )
    return false;
  if (name === "Read") return true;
  return (
    name === "Write" &&
    allowWrite &&
    typeof i.content === "string" &&
    i.content.length <= 32 &&
    ["FORK-40", "JWT-40", "OAUTH-40"].includes(i.content.trim())
  );
}
