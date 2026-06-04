import { notFound } from "next/navigation";
import { prisma } from "@formbricks/database";
import { Heading2 } from "@formbricks/ui/components/Heading2";
import { getSession } from "@/app/lib/auth";
import { hasUserOrganizationRole } from "@/app/lib/organization";
import { StyleGuidesContent } from "./components/StyleGuidesContent";

interface StyleGuidesPageProps {
  params: {
    workspaceId: string;
  };
}

export default async function StyleGuidesPage({ params }: StyleGuidesPageProps) {
  const session = await getSession();

  if (!session || !session.user?.id) {
    notFound();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
    include: { organization: true },
  });

  if (!workspace) {
    notFound();
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, workspace.organizationId, "member");
  if (!hasAccess) {
    notFound();
  }

  const styleGuides = await prisma.styleGuide.findMany({
    where: { organizationId: workspace.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const isOwner = await hasUserOrganizationRole(session.user.id, workspace.organizationId, "owner");

  return (
    <div className="space-y-6 py-6">
      <div>
        <Heading2>Style Guides</Heading2>
        <p className="text-slate-600">Apply your organization's branding to surveys with ease</p>
      </div>

      <StyleGuidesContent
        workspaceId={params.workspaceId}
        organizationId={workspace.organizationId}
        styleGuides={styleGuides}
        isOwner={isOwner}
        activeStyleGuideId={workspace.activeStyleGuideId}
      />
    </div>
  );
}
