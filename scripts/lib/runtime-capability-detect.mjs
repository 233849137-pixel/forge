import { spawnSync } from "node:child_process";
import executionBackendContractConfigs from "../../config/forge-execution-backend-contracts.json" with { type: "json" };

const defaultNanoManagerCommandTemplate =
  'node "{repoRoot}/scripts/forge-nanoclaw-manager.mjs" --command "{commandType}" --project-id "{projectId}" --stage "{stage}" --taskpack-id "{taskPackId}" --agent-id "{agentId}" --controller-id "{controllerAgentId}" --provider "{provider}" --workspace "{cwd}"';

function getTrimmedEnvValue(env = process.env, key) {
  return String(env?.[key] || "").trim();
}

export function splitCommandString(command) {
  return String(command)
    .trim()
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"(.*)"$/, "$1")) ?? [];
}

export function detectBinaryVersion(binaryPath, args = ["--version"]) {
  if (!binaryPath || !String(binaryPath).trim()) {
    return null;
  }

  const result = spawnSync(String(binaryPath).trim(), args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  const output = [result.stdout, result.stderr]
    .map((item) => String(item || "").trim())
    .find(Boolean);

  return output || null;
}

export function detectExecutableInfo(command, versionArgs = ["--version"]) {
  const path = detectExecutable(command);

  if (!path) {
    return null;
  }

  return {
    path,
    version: detectBinaryVersion(path, versionArgs)
  };
}

export function detectExecutable(command) {
  if (!command || !String(command).trim()) {
    return null;
  }

  const result = spawnSync("which", [String(command).trim()], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  const output = String(result.stdout || "").trim();
  return output || null;
}

export function detectExternalExecutionCapability(kind, env = process.env, runtime = {}) {
  const normalizedKind = String(kind || "").trim();
  const contractConfig = executionBackendContractConfigs.find((item) => item.kind === normalizedKind);

  if (!contractConfig) {
    return null;
  }

  const laneCommandKey = contractConfig.source;
  const laneCommandTemplate = getTrimmedEnvValue(env, laneCommandKey);
  const laneProvider = getTrimmedEnvValue(env, contractConfig.providerKey);
  const laneBackend = getTrimmedEnvValue(env, contractConfig.backendKey);
  const laneBackendCommandTemplate = getTrimmedEnvValue(env, contractConfig.commandKey);
  const nanoProvider = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_PROVIDER") || "Nano CEO";
  const nanoBackend = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_BACKEND");
  const nanoBackendCommandTemplate = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_BACKEND_COMMAND");
  const usesGlobalNanoManager =
    !laneCommandTemplate &&
    !laneBackend &&
    !laneBackendCommandTemplate &&
    Boolean(nanoBackend || nanoBackendCommandTemplate);
  const commandKey = laneCommandTemplate
    ? laneCommandKey
    : nanoBackendCommandTemplate
      ? "FORGE_NANO_EXEC_BACKEND_COMMAND"
      : usesGlobalNanoManager
        ? "internal-default:nanoclaw-manager"
        : laneCommandKey;
  const commandTemplate =
    laneCommandTemplate ||
    nanoBackendCommandTemplate ||
    (usesGlobalNanoManager ? defaultNanoManagerCommandTemplate : "");

  if (!commandTemplate) {
    return null;
  }

  const command = splitCommandString(commandTemplate);

  if (command.length === 0) {
    return null;
  }

  const resolveExecutable = runtime.detectExecutable || detectExecutable;
  const resolveVersion = runtime.detectBinaryVersion || detectBinaryVersion;
  const binaryPath = resolveExecutable(command[0]) || command[0];
  const version = binaryPath ? resolveVersion(binaryPath, ["--version"]) : null;
  const backendCommandTemplate =
    laneBackendCommandTemplate ||
    nanoBackendCommandTemplate ||
    (usesGlobalNanoManager ? defaultNanoManagerCommandTemplate : "");
  const backendCommand = backendCommandTemplate ? splitCommandString(backendCommandTemplate) : [];
  const backendBinaryPath =
    backendCommand.length > 0 ? resolveExecutable(backendCommand[0]) || backendCommand[0] : null;
  const backendVersion =
    backendBinaryPath && backendCommand.length > 0
      ? resolveVersion(backendBinaryPath, ["--version"])
      : null;

  return {
    id: contractConfig.id,
    kind: contractConfig.kind,
    label: contractConfig.label,
    command,
    provider: laneProvider || (laneCommandTemplate ? command[0] : nanoProvider),
    backend: laneBackend || nanoBackend || (backendCommand.length > 0 ? backendCommand[0] : ""),
    commandKey: contractConfig.commandKey,
    backendCommand: backendCommand.length > 0 ? backendCommand : null,
    backendCommandSource:
      backendCommand.length > 0
        ? laneBackendCommandTemplate
          ? contractConfig.commandKey
          : nanoBackendCommandTemplate
            ? "FORGE_NANO_EXEC_BACKEND_COMMAND"
            : usesGlobalNanoManager
              ? "internal-default:nanoclaw-manager"
              : null
        : null,
    backendBinaryPath,
    backendVersion,
    binaryPath,
    version,
    source: commandKey
  };
}
