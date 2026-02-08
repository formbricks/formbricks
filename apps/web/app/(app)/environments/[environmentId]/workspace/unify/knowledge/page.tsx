import { IS_STORAGE_CONFIGURED } from "@/lib/constants";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { KnowledgeSection } from "./components/KnowledgeSection";

export default async function UnifyKnowledgePage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return (
    <KnowledgeSection
      environmentId={params.environmentId}
      isStorageConfigured={IS_STORAGE_CONFIGURED}
    />
  );
}
