"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit2Icon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { AttributeIcon } from "@/modules/ee/contacts/segments/components/attribute-icon";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

interface AttributeKeysTableProps {
  attributeKeys: TContactAttributeKey[];
  onEdit: (key: TContactAttributeKey) => void;
  onDelete: (key: TContactAttributeKey) => void;
  isDeleting?: boolean;
}

export const AttributeKeysTable = ({
  attributeKeys,
  onEdit,
  onDelete,
  isDeleting,
}: AttributeKeysTableProps) => {
  const { t } = useTranslation();

  if (attributeKeys.length === 0) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <p className="text-slate-500">{t("environments.contacts.attributes.no_keys_found")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t("common.name")} / {t("common.key")}
            </TableHead>
            <TableHead>{t("common.description")}</TableHead>
            <TableHead>{t("common.type")}</TableHead>
            <TableHead>{t("common.last_updated")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attributeKeys.map((attributeKey) => (
            <TableRow key={attributeKey.key}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">{attributeKey.name}</span>
                  <span className="font-mono text-xs text-slate-500">{attributeKey.key}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-slate-500">
                {attributeKey.description || "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <AttributeIcon dataType={attributeKey.dataType} className="h-4 w-4 text-slate-500" />
                  <span className="capitalize text-slate-700">{attributeKey.dataType}</span>
                </div>
              </TableCell>
              <TableCell className="text-slate-500">
                {formatDistanceToNow(new Date(attributeKey.updatedAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(attributeKey)}>
                    <Edit2Icon className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(attributeKey)}
                    disabled={isDeleting}>
                    <Trash2Icon className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
