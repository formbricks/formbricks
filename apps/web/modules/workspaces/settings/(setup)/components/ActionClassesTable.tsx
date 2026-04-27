"use client";

import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { ActionDetailModal } from "./ActionDetailModal";

interface ActionClassesTableProps {
  actionClasses: TActionClass[];
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
}

export const ActionClassesTable = ({
  actionClasses,
  children: [TableHeading, actionRows],
  isReadOnly,
}: ActionClassesTableProps) => {
  const { t } = useTranslation();
  const [isActionDetailModalOpen, setIsActionDetailModalOpen] = useState(false);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>();

  const handleOpenActionDetailModalClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    actionClass: TActionClass
  ) => {
    e.preventDefault();
    setActiveActionClass(actionClass);
    setIsActionDetailModalOpen(true);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {TableHeading}
        <div id="actionClassesWrapper" className="flex flex-col">
          {actionClasses.length > 0 ? (
            actionClasses.map((actionClass, index) => (
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  handleOpenActionDetailModalClick(e, actionClass);
                }}
                className="w-full"
                title={actionClass.name}
                key={actionClass.id}>
                {actionRows[index]}
              </button>
            ))
          ) : (
            <div className="py-8 text-center">
              <span className="text-sm text-slate-500">{t("common.no_actions_found")}</span>
            </div>
          )}
        </div>
      </div>
      {activeActionClass && (
        <ActionDetailModal
          open={isActionDetailModalOpen}
          setOpen={setIsActionDetailModalOpen}
          actionClasses={actionClasses}
          actionClass={activeActionClass}
          isReadOnly={isReadOnly}
        />
      )}
    </>
  );
};
