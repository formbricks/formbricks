import GoogleTagOverviewTab from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleOverviewTab";
import GoogleTagSettingsTab from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagSettingsTab";
import { Tag } from "lucide-react";

import { TGoogleTag } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";

interface GoogleTagModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  tag: TGoogleTag;
  surveys: TSurvey[];
}

export default function GoogleTagModal({ environmentId, open, setOpen, tag, surveys }: GoogleTagModalProps) {
  const tabs = [
    {
      title: "Overview",
      children: <GoogleTagOverviewTab tag={tag} surveys={surveys} />,
    },
    {
      title: "Settings",
      children: (
        <GoogleTagSettingsTab environmentId={environmentId} tag={tag} surveys={surveys} setOpen={setOpen} />
      ),
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={<Tag />}
        label={tag.name ? tag.name : tag.gtmId}
        description={""}
      />
    </>
  );
}
