"use client";

import { ShareIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";

import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";

import ShareEmbedSurvey from "./ShareEmbedSurvey";

interface LinkSurveyShareButtonProps {
  survey: TSurvey;
  className?: string;
  webAppUrl: string;
  product: TProduct;
  user: TUser;
}

export default function LinkSurveyShareButton({
  survey,
  className,
  webAppUrl,
  product,
  user,
}: LinkSurveyShareButtonProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        className={clsx(
          "border border-slate-300 bg-white px-2 hover:bg-slate-100 focus:bg-slate-100 lg:px-6",
          className
        )}
        onClick={() => {
          setShowLinkModal(true);
        }}>
        <ShareIcon className="h-5 w-5" />
      </Button>
      {showLinkModal && (
        <ShareEmbedSurvey
          survey={survey}
          open={showLinkModal}
          setOpen={setShowLinkModal}
          product={product}
          webAppUrl={webAppUrl}
          user={user}
        />
      )}
    </>
  );
}
