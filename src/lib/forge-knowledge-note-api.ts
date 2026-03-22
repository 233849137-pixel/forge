type ForgeApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

export type ReadForgeKnowledgeNoteContentInput = {
  relativePath: string;
};

export type ReadForgeKnowledgeNoteContentResult = {
  relativePath: string;
  body: string;
};

export type SaveForgeKnowledgeNoteContentInput = {
  relativePath: string;
  body: string;
};

export type SaveForgeKnowledgeNoteContentResult = {
  relativePath: string;
  body: string;
};

async function readForgeApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ForgeApiEnvelope<T>;

  if (!response.ok || payload.ok === false) {
    throw new Error(
      payload.ok === false
        ? payload.error?.message ?? "读取知识库笔记失败。"
        : "读取知识库笔记失败。",
    );
  }

  return payload.data;
}

export async function readForgeKnowledgeNoteContent(
  input: ReadForgeKnowledgeNoteContentInput,
): Promise<ReadForgeKnowledgeNoteContentResult> {
  const searchParams = new URLSearchParams({
    relativePath: input.relativePath,
  });
  const response = await fetch(
    `/api/forge/knowledge-base/note?${searchParams.toString()}`,
  );

  return readForgeApiPayload<ReadForgeKnowledgeNoteContentResult>(response);
}

export async function saveForgeKnowledgeNoteContent(
  input: SaveForgeKnowledgeNoteContentInput,
): Promise<SaveForgeKnowledgeNoteContentResult> {
  const response = await fetch("/api/forge/knowledge-base/note", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readForgeApiPayload<SaveForgeKnowledgeNoteContentResult>(response);
}
