import { spawn } from "node:child_process";

function tryParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function executeShellPlan(plan) {
  return await new Promise((resolve) => {
    const [command, ...args] = Array.isArray(plan?.command) ? plan.command : [];

    if (!command) {
      resolve({
        ok: false,
        exitCode: null,
        summary: "执行计划缺少可执行命令。"
      });
      return;
    }

    const child = spawn(command, args, {
      cwd: plan?.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        exitCode: null,
        summary: `无法启动执行计划：${error.message}`
      });
    });

    child.on("close", (code) => {
      const stdoutText = stdout.trim();
      const stderrText = stderr.trim();
      const parsed = tryParseJson(stdoutText);
      const parsedSummary =
        parsed && typeof parsed === "object" && typeof parsed.summary === "string"
          ? parsed.summary
          : null;
      const text = [parsedSummary || stdoutText, stderrText].filter(Boolean).join(" | ");

      resolve({
        ok: code === 0,
        exitCode: code,
        data: parsed,
        summary:
          text || (code === 0 ? "执行计划已完成。" : `执行计划失败，退出码 ${code ?? "unknown"}。`)
      });
    });
  });
}
