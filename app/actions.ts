"use server";

import { revalidatePath } from "next/cache";
import { executeCommandForAI } from "../packages/ai/src";
import {
  createProject,
  generatePrdDraft,
  loadDashboardSnapshot,
  setActiveProject,
  updateProjectWorkflowState
} from "../packages/db/src";

function buildProjectId(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "project"}-${Date.now().toString(36)}`;
}

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  const owner = String(formData.get("owner") ?? "").trim();

  if (!name || !templateId || !sector || !owner) {
    return;
  }

  createProject(
    {
      id: buildProjectId(name),
      name,
      sector,
      owner,
      templateId
    }
  );

  revalidatePath("/");
}

export async function setActiveProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!projectId) {
    return;
  }

  setActiveProject(projectId);
  revalidatePath("/");
}

export async function generatePrdDraftAction(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "").trim();
  const extraNotes = String(formData.get("extraNotes") ?? "").trim();
  const snapshot = loadDashboardSnapshot();
  const activeProjectId = snapshot.activeProjectId ?? snapshot.projects[0]?.id ?? "";

  if (!templateId || !activeProjectId) {
    return;
  }

  generatePrdDraft(
    {
      projectId: activeProjectId,
      templateId,
      extraNotes
    }
  );

  revalidatePath("/");
}

export async function executeCommandAction(formData: FormData) {
  const commandId = String(formData.get("commandId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const extraNotes = String(formData.get("extraNotes") ?? "").trim();

  if (!commandId) {
    return;
  }

  executeCommandForAI({
    commandId,
    projectId: projectId || undefined,
    extraNotes: extraNotes || undefined,
    triggeredBy: "工作台"
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/artifacts");
  revalidatePath("/execution");
  revalidatePath("/governance");
}

function parseKnowledgeSources(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateProjectWorkflowStateAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const currentStage = String(formData.get("currentStage") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const blockers = parseKnowledgeSources(String(formData.get("blockers") ?? ""));

  if (!projectId || !currentStage || !state) {
    return;
  }

  updateProjectWorkflowState({
    projectId,
    currentStage: currentStage as never,
    state: state as never,
    blockers,
    updatedBy: "pm"
  });

  revalidatePath("/projects");
  revalidatePath("/");
}
