import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDashboardSnapshot } from "../../../../../../packages/db/src";
import { buildForgeAgentMarkdown, type ForgeAgentDocSection } from "../../../../../../src/lib/forge-agent-docs";
import { hydrateSnapshotWithRealSkills } from "../../../../../../src/server/forge-real-skills";

const validSections = new Set<ForgeAgentDocSection>(["basic", "ability", "runtime"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const sectionParam = new URL(request.url).searchParams.get("section");
  const section = validSections.has(sectionParam as ForgeAgentDocSection)
    ? (sectionParam as ForgeAgentDocSection)
    : "ability";
  const snapshot = hydrateSnapshotWithRealSkills(loadDashboardSnapshot());
  const agent = snapshot.agents.find((item) => item.id === agentId);

  if (!agent) {
    return new Response("Agent not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  const repoDocPath = join(process.cwd(), "docs", "agents", `${agent.id}.md`);
  const liveMarkdown = buildForgeAgentMarkdown(snapshot, agent, section);
  const repoDocMarkdown = existsSync(repoDocPath) ? readFileSync(repoDocPath, "utf8").trim() : "";
  const markdown = repoDocMarkdown
    ? `${liveMarkdown}\n\n---\n\n## Canonical Profile\n\n${repoDocMarkdown}\n`
    : liveMarkdown;

  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename=\"${agent.id}-${section}.md\"`
    }
  });
}
