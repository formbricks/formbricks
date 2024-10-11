import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { checkForYoutubeUrl } from "@formbricks/lib/utils/videoUpload";
import { extractYoutubeId, parseVideoUrl } from "@formbricks/lib/utils/videoUpload";
import { AdvancedOptionToggle } from "../../AdvancedOptionToggle";
import { Button } from "../../Button";
import { Input } from "../../Input";
import { Label } from "../../Label";
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
  const [isYoutubeLink, setIsYoutubeLink] = useState(checkForYoutubeUrl(uploadedVideoUrl));
  const [isYoutubePrivacyModeEnabled, setIsYoutubePrivacyModeEnabled] = useState(
    checkForYoutubePrivacyMode(uploadedVideoUrl)
  );
  const [showPlatformWarning, setShowPlatformWarning] = useState(false);
  const toggleYoutubePrivacyMode = () => {
    setIsYoutubePrivacyModeEnabled(!isYoutubePrivacyModeEnabled);

    const videoId = extractYoutubeId(uploadedVideoUrl);
    if (!videoId) {
      toast.error("Invalid YouTube URL");
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
    const parsedUrl = parseVideoUrl(uploadedVideoUrl);
    if (parsedUrl) {
      setUploadedVideoUrl(parsedUrl);
      onFileUpload([parsedUrl], "video");
    } else {
      toast.error("Url not supported");
    }
  };

  const handleRemoveVideo = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();
    setVideoUrlTemp("");
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
    return uploadedVideoUrl.trim() !== "" ? false : true;
  };

  return (
    <form className="flex flex-col space-y-4">
      <Label>Video URL(Youtube, Vimeo or Loom):</Label>
      <div className="flex h-10 items-center space-x-2">
        <Input
          className="w-full"
          placeholder="https://www.youtube.com/embed/VIDEO_ID"
          value={uploadedVideoUrl}
          onChange={(e) => handleVideoUrlChange(e)}
        />
        {uploadedVideoUrl && videoUrl === uploadedVideoUrl ? (
          <Button variant="secondary" onClick={(e) => handleRemoveVideo(e)}>
            Remove
          </Button>
        ) : (
          <Button onClick={(e) => handleAddVideo(e)} disabled={isAddButtonDisabled()}>
            Add
          </Button>
        )}
      </div>

      {showPlatformWarning && (
        <div className="flex items-center space-x-2 rounded-md border bg-slate-100 p-2 text-xs text-slate-600">
          <AlertTriangle className="h-6 w-6" />
          <p>
            Please enter a valid Youtube, Vimeo or Loom Url. We currently do not support other video hosting
            providers.
          </p>
        </div>
      )}
      {isYoutubeLink && (
        <AdvancedOptionToggle
          htmlId="closeOnNumberOfResponse"
          isChecked={isYoutubePrivacyModeEnabled}
          onToggle={() => {
            toggleYoutubePrivacyMode();
          }}
          title="YouTube Privacy Mode"
          description="Keeps user tracking to a minimum"
          childBorder={true}></AdvancedOptionToggle>
      )}
    </form>
  );
};
