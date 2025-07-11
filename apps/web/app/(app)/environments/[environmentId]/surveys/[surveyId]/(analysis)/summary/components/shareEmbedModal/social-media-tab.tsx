"use client";

import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FacebookIcon } from "@/modules/ui/components/icons/facebook-icon";
import { LinkedinIcon } from "@/modules/ui/components/icons/linkedin-icon";
import { RedditIcon } from "@/modules/ui/components/icons/reddit-icon";
import { ThreadsIcon } from "@/modules/ui/components/icons/threads-icon";
import { XIcon } from "@/modules/ui/components/icons/x-icon";
import { useTranslate } from "@tolgee/react";
import { useMemo } from "react";

interface SocialMediaTabProps {
  surveyUrl: string;
  surveyTitle?: string;
}

export const SocialMediaTab: React.FC<SocialMediaTabProps> = ({ surveyUrl, surveyTitle = "" }) => {
  const { t } = useTranslate();

  const socialMediaPlatforms = useMemo(() => {
    const shareText = surveyTitle || "Check out this survey";

    // Add source tracking to the survey URL
    const getTrackedUrl = (platform: string) => {
      const sourceParam = `source=${platform.toLowerCase()}`;
      const separator = surveyUrl.includes("?") ? "&" : "?";
      return `${surveyUrl}${separator}${sourceParam}`;
    };

    return [
      {
        id: "linkedin",
        name: "LinkedIn",
        icon: <LinkedinIcon />,
        url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(getTrackedUrl("linkedin"))}&title=${encodeURIComponent(shareText)}`,
        description: "Share on LinkedIn",
      },
      {
        id: "threads",
        name: "Threads",
        icon: <ThreadsIcon />,
        url: `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}%20${encodeURIComponent(getTrackedUrl("threads"))}`,
        description: "Share on Threads",
      },
      {
        id: "facebook",
        name: "Facebook",
        icon: <FacebookIcon />,
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getTrackedUrl("facebook"))}`,
        description: "Share on Facebook",
      },
      {
        id: "reddit",
        name: "Reddit",
        icon: <RedditIcon />,
        url: `https://www.reddit.com/submit?url=${encodeURIComponent(getTrackedUrl("reddit"))}&title=${encodeURIComponent(shareText)}`,
        description: "Share on Reddit",
      },
      {
        id: "x",
        name: "X",
        icon: <XIcon />,
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(getTrackedUrl("x"))}`,
        description: "Share on X (formerly Twitter)",
      },
    ];
  }, [surveyUrl, surveyTitle]);

  const handleSocialShare = (url: string) => {
    // Open sharing window
    window.open(
      url,
      "share-dialog",
      "width=600,height=400,location=no,toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes"
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          {t("environments.surveys.summary.share_your_survey_on_social_media")}
        </h3>
        <p className="text-sm text-slate-600">
          {t(
            "environments.surveys.summary.get_responses_from_your_contacts_on_various_social_media_networks"
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {socialMediaPlatforms.map((platform) => (
          <Button
            key={platform.name}
            variant="outline"
            className="w-fit"
            onClick={() => handleSocialShare(platform.url)}>
            {platform.name}
            {platform.icon}
          </Button>
        ))}
      </div>

      <Alert>
        <AlertTitle>{t("environments.surveys.summary.source_tracking_enabled")}</AlertTitle>
        <AlertDescription>
          {t("environments.surveys.summary.source_tracking_enabled_alert_description")}
        </AlertDescription>
        <AlertButton
          onClick={() => {
            window.open(
              "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/source-tracking",
              "_blank",
              "noopener,noreferrer"
            );
          }}>
          {t("common.learn_more")}
        </AlertButton>
      </Alert>
    </div>
  );
};
