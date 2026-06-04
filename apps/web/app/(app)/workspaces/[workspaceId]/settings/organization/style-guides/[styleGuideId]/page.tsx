import { notFound } from "next/navigation";
import { prisma } from "@formbricks/database";
import { getSession } from "@/app/lib/auth";
import { hasUserOrganizationRole } from "@/app/lib/organization";
import { StyleGuideEditor } from "../components/StyleGuideEditor";

interface StyleGuideEditPageProps {
  params: {
    workspaceId: string;
    styleGuideId: string;
  };
}

export default async function StyleGuideEditPage({ params }: StyleGuideEditPageProps) {
  const session = await getSession();

  if (!session || !session.user?.id) {
    notFound();
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: params.styleGuideId },
  });

  if (!styleGuide) {
    notFound();
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "member");
  if (!hasAccess) {
    notFound();
  }

  const isOwner = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "owner");

  return (
    <div className="py-6">
      <StyleGuideEditor styleGuide={styleGuide} workspaceId={params.workspaceId} isOwner={isOwner} />
    </div>
  );
}
