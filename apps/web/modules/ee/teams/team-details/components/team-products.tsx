"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { updateTeamProductPermissionAction } from "@/modules/ee/teams/team-details/actions";
import { AddTeamProductModal } from "@/modules/ee/teams/team-details/components/add-team-product-modal";
import { TOrganizationProduct, TTeamProduct } from "@/modules/ee/teams/team-details/types/teams";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";
import { removeTeamProductAction } from "../actions";

interface TeamProductsProps {
  membershipRole?: TOrganizationRole;
  products: TTeamProduct[];
  teamId: string;
  organizationProducts: TOrganizationProduct[];
}

export const TeamProducts = ({
  membershipRole,
  products,
  teamId,
  organizationProducts,
}: TeamProductsProps) => {
  const t = useTranslations();
  const [openAddProductModal, setOpenAddProductModal] = useState<boolean>(false);
  const [removeProductModalOpen, setRemoveProductModalOpen] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleRemoveProduct = async (productId: string) => {
    const removeProductActionResponse = await removeTeamProductAction({
      teamId,
      productId,
    });

    if (removeProductActionResponse?.data) {
      toast.success(t("environments.settings.teams.product_removed_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeProductActionResponse);
      toast.error(errorMessage);
    }

    setRemoveProductModalOpen(false);
  };

  const handlePermissionChange = async (productId: string, permission: TTeamPermission) => {
    const updateTeamPermissionResponse = await updateTeamProductPermissionAction({
      teamId,
      productId,
      permission,
    });
    if (updateTeamPermissionResponse?.data) {
      toast.success(t("environments.settings.teams.permission_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateTeamPermissionResponse);
      toast.error(errorMessage);
    }
  };

  const productOptions = useMemo(
    () =>
      organizationProducts
        .filter((product) => !products.find((p) => p.id === product.id))
        .map((product) => ({
          label: product.name,
          value: product.id,
        })),
    [organizationProducts, products]
  );

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("environments.settings.teams.team_products")}</CardTitle>
          <div className="flex gap-2">
            {isOwnerOrManager && (
              <Button variant="primary" size="sm" onClick={() => setOpenAddProductModal(true)}>
                {t("environments.settings.teams.add_product")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>{t("environments.settings.teams.product_name")}</TableHead>
                  <TableHead>{t("environments.settings.teams.permission")}</TableHead>
                  {isOwnerOrManager && <TableHead>{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      {t("environments.settings.teams.empty_product_message")}
                    </TableCell>
                  </TableRow>
                )}
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-semibold">{product.name}</TableCell>
                    <TableCell>
                      {isOwnerOrManager ? (
                        <Select
                          value={product.permission}
                          onValueChange={(val: TTeamPermission) => {
                            handlePermissionChange(product.id, val);
                          }}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select type" className="text-sm" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ZTeamPermission.Enum.read}>
                              {t("environments.settings.teams.read")}
                            </SelectItem>
                            <SelectItem value={ZTeamPermission.Enum.readWrite}>
                              {t("environments.settings.teams.read_write")}
                            </SelectItem>
                            <SelectItem value={ZTeamPermission.Enum.manage}>
                              {t("environments.settings.teams.manage")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p>{TeamPermissionMapping[product.permission]}</p>
                      )}
                    </TableCell>
                    {isOwnerOrManager && (
                      <TableCell>
                        <Button
                          disabled={!isOwnerOrManager}
                          variant="warn"
                          size="sm"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setRemoveProductModalOpen(true);
                          }}>
                          {t("common.remove")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {openAddProductModal && (
        <AddTeamProductModal
          teamId={teamId}
          open={openAddProductModal}
          setOpen={setOpenAddProductModal}
          productOptions={productOptions}
        />
      )}
      {removeProductModalOpen && selectedProductId && (
        <AlertDialog
          open={removeProductModalOpen}
          setOpen={setRemoveProductModalOpen}
          headerText={t("environments.settings.teams.remove_product")}
          mainText={t("environments.settings.teams.remove_product_confirmation")}
          confirmBtnLabel={t("common.confirm")}
          onDecline={() => {
            setSelectedProductId(null);
            setRemoveProductModalOpen(false);
          }}
          onConfirm={() => handleRemoveProduct(selectedProductId)}
        />
      )}
    </>
  );
};
