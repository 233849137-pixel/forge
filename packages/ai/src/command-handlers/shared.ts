import type {
  ForgeCommand,
  ForgeDashboardSnapshot,
  ForgeProject
} from "../../../core/src/types";
import type { ForgeRuntimeAdapter } from "../runtime-adapters";

export type ForgeExecuteCommandInput = {
  commandId: string;
  projectId?: string;
  taskPackId?: string;
  componentIds?: string[];
  extraNotes?: string;
  selectedModel?: string;
  thinkingBudget?: string;
  triggeredBy?: string;
};

export type ForgeCommandHandlerContext = {
  input: ForgeExecuteCommandInput;
  snapshot: ForgeDashboardSnapshot;
  command: ForgeCommand;
  project: ForgeProject;
  projectId: string;
  triggeredBy: string;
  executionId: string;
  dbPath?: string;
  runtimeAdapters: ForgeRuntimeAdapter[];
  deps: Record<string, unknown>;
};

export type ForgeCommandHandler = (context: ForgeCommandHandlerContext) => unknown;
