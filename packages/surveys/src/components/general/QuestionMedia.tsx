import { LoadingSpinner } from "@/components/general/LoadingSpinner";
import { useState } from "preact/hooks";

import {
  checkForLoomUrl,
  checkForVimeoUrl,
  checkForYoutubeUrl,
  parseVideoUrl,
} from "@formbricks/lib/utils/videoUpload";

//Function to add extra params to videoUrls in order to reduce video controls
const getVideoUrlWithParams = (videoUrl: string): string => {
  const isYoutubeVideo = checkForYoutubeUrl(videoUrl);
  const isVimeoUrl = checkForVimeoUrl(videoUrl);
  const isLoomUrl = checkForLoomUrl(videoUrl);
  if (isYoutubeVideo) return videoUrl.concat("?controls=0");
  else if (isVimeoUrl)
    return videoUrl.concat(
      "?title=false&transcript=false&speed=false&quality_selector=false&progress_bar=false&pip=false&fullscreen=false&cc=false&chromecast=false"
    );
  else if (isLoomUrl) return videoUrl.concat("?hide_share=true&hideEmbedTopBar=true&hide_title=true");
  else return videoUrl;
};

interface QuestionMediaProps {
  imgUrl?: string;
  videoUrl?: string;
  altText?: string;
}

export const QuestionMedia = ({ imgUrl, videoUrl, altText = "Image" }: QuestionMediaProps) => {
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const videoUrlWithParams = videoUrl ? getVideoUrlWithParams(videoUrl) : undefined;

  return (
    <div className="group/image relative mb-4 block rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imgUrl && <img src={imgUrl} alt={altText} className="rounded-custom" />}
      {videoUrlWithParams && (
        <div className="relative">
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
          <div className="rounded-custom bg-black">
            <iframe
              src={videoUrlWithParams}
              title="Question Video"
              frameborder="0"
              className="rounded-custom aspect-video w-full"
              onLoad={() => setIsVideoLoading(false)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
        </div>
      )}
      <a
        href={!!imgUrl ? imgUrl : parseVideoUrl(videoUrl ?? "")}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-2 rounded-md bg-gray-800 bg-opacity-40 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out hover:bg-opacity-65 group-hover/image:opacity-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          class="lucide lucide-expand">
          <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
          <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
          <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
          <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
        </svg>
      </a>
    </div>
  );
};
