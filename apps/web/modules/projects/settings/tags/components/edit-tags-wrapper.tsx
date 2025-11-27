"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { TTag, TTagsCount } from "@formbricks/types/tags";
import { SingleTag } from "@/modules/projects/settings/tags/components/single-tag";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface EditTagsWrapperProps {
  environmentTags: TTag[];
  environmentTagsCount: TTagsCount;
  isReadOnly: boolean;
}

export const EditTagsWrapper: React.FC<EditTagsWrapperProps> = (props) => {
  const { t } = useTranslation();
  const { environmentTags, environmentTagsCount, isReadOnly } = props;

  if (!environmentTags?.length) {
    return <EmptyState text={t("environments.project.tags.no_tag_found")} />;
  }

  return (
    <div className="">
      <div className="grid grid-cols-4 content-center rounded-lg bg-white text-left text-sm font-semibold text-slate-900">
        <div className="col-span-2">{t("environments.project.tags.tag")}</div>
        <div className="col-span-1 text-center">{t("environments.project.tags.count")}</div>
        {!isReadOnly && (
          <div className="col-span-1 flex justify-center text-center">{t("common.actions")}</div>
        )}
      </div>

      {environmentTags.map((tag) => (
        <SingleTag
          key={tag.id}
          tagId={tag.id}
          tagName={tag.name}
          tagCount={environmentTagsCount?.find((count) => count.tagId === tag.id)?.count ?? 0}
          environmentTags={environmentTags}
          isReadOnly={isReadOnly}
        />
      ))}
    </div>
  );
};
