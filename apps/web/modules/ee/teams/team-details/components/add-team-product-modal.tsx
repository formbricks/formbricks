"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { addTeamProductsAction } from "@/modules/ee/teams/team-details/actions";
import { UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { MultiSelect } from "@formbricks/ui/components/MultiSelect";
import { H4 } from "@formbricks/ui/components/Typography";

interface AddTeamProductModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  teamId: string;
  productOptions: { label: string; value: string }[];
}

export const AddTeamProductModal = ({ open, setOpen, teamId, productOptions }: AddTeamProductModalProps) => {
  const t = useTranslations();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleAddProducts = async (e) => {
    e.preventDefault();

    setIsLoading(true);

    const addMembersActionResponse = await addTeamProductsAction({
      teamId,
      productIds: selectedProducts,
    });
    if (addMembersActionResponse?.data) {
      toast.success(t("environments.settings.teams.members_added_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(addMembersActionResponse);
      toast.error(errorMessage);
    }

    setSelectedProducts([]);
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Modal noPadding size="md" open={open} setOpen={setOpen} className="overflow-visible">
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UserIcon className="h-5 w-5" />
            <H4>{t("environments.settings.teams.add_products")}</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleAddProducts}>
        <div className="overflow-visible p-6">
          <Label className="mb-1 text-sm font-medium text-slate-900">
            {t("environments.settings.teams.organization_products")}
          </Label>
          <MultiSelect
            value={selectedProducts}
            options={productOptions}
            onChange={(value) => {
              setSelectedProducts(value);
            }}
          />
        </div>
        <div className="flex items-end justify-end gap-2 p-6 pt-0">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false);
              setSelectedProducts([]);
            }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isLoading} loading={isLoading} type="submit">
            {t("common.add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
