"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { checkForYoutubeUrl, convertToEmbedUrl, extractYoutubeId } from "@formbricks/lib/utils/videoUpload";
import { Label } from "../../label";
import { checkForYoutubePrivacyMode } from "../lib/utils";

interface VideoSettingsProps {
  uploadedVideoUrl: string;
  setUploadedVideoUrl: (videoUrl: string) => void;
  onFileUpload: (uploadedUrl: string[] | undefined, fileType: "image" | "video") => void;
  videoUrl: string;
  setVideoUrlTemp: (videoUrl: string) => void;
}

export const VideoSettings = ({
  uploadedVideoUrl,
  setUploadedVideoUrl,
  onFileUpload,
  videoUrl,
  setVideoUrlTemp,
}: VideoSettingsProps) => {
  const { t } = useTranslate();
  const [isYoutubeLink, setIsYoutubeLink] = useState(checkForYoutubeUrl(uploadedVideoUrl));
  const [isYoutubePrivacyModeEnabled, setIsYoutubePrivacyModeEnabled] = useState(
    checkForYoutubePrivacyMode(uploadedVideoUrl)
  );
  const [showPlatformWarning, setShowPlatformWarning] = useState(false);
  const toggleYoutubePrivacyMode = () => {
    setIsYoutubePrivacyModeEnabled(!isYoutubePrivacyModeEnabled);

    const videoId = extractYoutubeId(uploadedVideoUrl);
    if (!videoId) {
      toast.error(t("environments.surveys.edit.invalid_youtube_url"));
      return;
    }
    const newUrl = isYoutubePrivacyModeEnabled
      ? `https://www.youtube.com/embed/${videoId}`
      : `https://www.youtube-nocookie.com/embed/${videoId}`;

    setUploadedVideoUrl(newUrl);
    if (videoUrl) {
      onFileUpload([newUrl], "video");
    }
  };

  const handleAddVideo = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();
    const embedUrl = convertToEmbedUrl(uploadedVideoUrl.trim());
    if (embedUrl) {
      setUploadedVideoUrl(embedUrl);
      onFileUpload([embedUrl], "video");
    } else {
      toast.error(t("environments.surveys.edit.url_not_supported"));
    }
  };

  const handleRemoveVideo = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();
    setVideoUrlTemp("");
    setUploadedVideoUrl("");
    onFileUpload([], "video");
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoUrl = e.target.value;
    setUploadedVideoUrl(videoUrl);

    // Check if the URL is from one of the supported platforms
    const isSupportedPlatform = [
      "youtube.com",
      "youtu.be",
      "youtube-nocookie.com",
      "vimeo.com",
      "loom.com",
    ].some((domain) => videoUrl.includes(domain));

    setIsYoutubeLink(checkForYoutubeUrl(videoUrl));
    setShowPlatformWarning(!isSupportedPlatform);
    setIsYoutubePrivacyModeEnabled(checkForYoutubePrivacyMode(videoUrl));
  };

  const isAddButtonDisabled = () => {
    return uploadedVideoUrl.trim() === "";
  };

  return (
    <div className="flex flex-col space-y-4">
      <Label>Video URL (YouTube, Vimeo, or Loom):</Label>
      <div className="flex h-10 items-center space-x-2">
        <Input
          className="w-full"
          placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
          value={uploadedVideoUrl}
          onChange={handleVideoUrlChange}
        />
        {uploadedVideoUrl && videoUrl === uploadedVideoUrl ? (
          <Button variant="secondary" onClick={handleRemoveVideo}>
            {t("common.remove")}
          </Button>
        ) : (
          <Button onClick={handleAddVideo} disabled={isAddButtonDisabled()}>
            {t("common.add")}
          </Button>
        )}
      </div>

      {showPlatformWarning && (
        <Alert variant="warning" size="small">
          <AlertTitle>{t("environments.surveys.edit.invalid_video_url_warning")}</AlertTitle>
        </Alert>
      )}

      {isYoutubeLink && (
        <AdvancedOptionToggle
          htmlId="youtubePrivacyMode"
          isChecked={isYoutubePrivacyModeEnabled}
          onToggle={toggleYoutubePrivacyMode}
          title="YouTube Privacy Mode"
          description="Keeps user tracking to a minimum"
          childBorder={true}></AdvancedOptionToggle>
      )}
    </div>
  );
};
