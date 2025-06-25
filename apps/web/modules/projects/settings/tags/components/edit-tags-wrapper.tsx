"use client";

import { SingleTag } from "@/modules/projects/settings/tags/components/single-tag";
import { EmptySpaceFiller } from "@/modules/ui/components/empty-space-filler";
import { useTranslate } from "@tolgee/react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TTag, TTagsCount } from "@formbricks/types/tags";

interface EditTagsWrapperProps {
  environment: TEnvironment;
  environmentTags: TTag[];
  environmentTagsCount: TTagsCount;
  isReadOnly: boolean;
}

export const EditTagsWrapper: React.FC<EditTagsWrapperProps> = (props) => {
  const { t } = useTranslate();
  const { environment, environmentTags, environmentTagsCount, isReadOnly } = props;
  return (
    <div className="">
      <div className="grid grid-cols-4 content-center rounded-lg bg-white text-left text-sm font-semibold text-slate-900">
        <div className="col-span-2">{t("environments.project.tags.tag")}</div>
        <div className="col-span-1 text-center">{t("environments.project.tags.count")}</div>
        {!isReadOnly && (
          <div className="col-span-1 flex justify-center text-center">{t("common.actions")}</div>
        )}
      </div>

      {!environmentTags?.length ? (
        <EmptySpaceFiller environment={environment} type="tag" noWidgetRequired />
      ) : null}

      {environmentTags?.map((tag) => (
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
