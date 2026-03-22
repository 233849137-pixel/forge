import {
  createProjectForAI,
  deleteProjectForAI,
  listProjectsForAI,
  updateProjectForAI
} from "../../../../packages/ai/src/forge-ai";
import {
  forgeError,
  forgeSuccess,
  readJsonBody,
  readJsonObjectBody,
  readRequiredString
} from "../../../../src/lib/forge-api-response";

function buildProjectDraftFromRequirement(requirement: string) {
  const normalized = requirement.trim();
  if (!normalized) {
    return null;
  }

  const name = normalized.includes("客服")
    ? "零售客服副驾驶"
    : normalized.includes("知识")
      ? "知识助手项目"
      : "新建项目";
  const sector =
    normalized.includes("零售") || normalized.includes("客服")
      ? "智能客服 / 零售"
      : normalized.includes("知识")
        ? "知识助手 / 企业知识库"
        : "通用交付 / AI应用";

  return {
    name,
    sector,
    owner: "Jy",
    enterpriseName: "演示客户",
    projectType: normalized.includes("客服") ? "客服副驾驶" : "AI 应用",
    deliveryDate: "",
    note: ""
  };
}

export async function GET() {
  try {
    return forgeSuccess(listProjectsForAI());
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const projectInput =
      body && typeof body === "object" && "requirement" in body && typeof body.requirement === "string"
        ? (() => {
            const draft = buildProjectDraftFromRequirement(body.requirement);
            return {
              requirement: body.requirement,
              name: "name" in body && typeof body.name === "string" ? body.name : draft?.name,
              sector: "sector" in body && typeof body.sector === "string" ? body.sector : draft?.sector,
              owner: "owner" in body && typeof body.owner === "string" ? body.owner : draft?.owner,
              enterpriseName:
                "enterpriseName" in body && typeof body.enterpriseName === "string"
                  ? body.enterpriseName
                  : draft?.enterpriseName,
              projectType:
                "projectType" in body && typeof body.projectType === "string"
                  ? body.projectType
                  : draft?.projectType,
              deliveryDate:
                "deliveryDate" in body && typeof body.deliveryDate === "string"
                  ? body.deliveryDate
                  : draft?.deliveryDate,
              note: "note" in body && typeof body.note === "string" ? body.note : draft?.note,
              demoSeed: "demoSeed" in body ? body.demoSeed === true : false,
              teamTemplateId:
                "teamTemplateId" in body && typeof body.teamTemplateId === "string"
                  ? body.teamTemplateId
                  : undefined,
              templateId:
                "templateId" in body && typeof body.templateId === "string" ? body.templateId : undefined
            };
          })()
        : body;

    return forgeSuccess(createProjectForAI(projectInput), { status: 201 });
  } catch (error) {
    return forgeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody(request);
    return forgeSuccess(updateProjectForAI(body));
  } catch (error) {
    return forgeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(deleteProjectForAI(readRequiredString(body, "projectId", "项目 ID")));
  } catch (error) {
    return forgeError(error);
  }
}
