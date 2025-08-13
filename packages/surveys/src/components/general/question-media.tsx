import { ExpandIcon } from "@/components/icons/expand-icon";
import { ImageDownIcon } from "@/components/icons/image-down-icon";
import { cn } from "@/lib/utils";
import { checkForLoomUrl, checkForVimeoUrl, checkForYoutubeUrl, convertToEmbedUrl } from "@/lib/video-upload";
import { useState } from "preact/hooks";

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
  return videoUrl;
};

interface QuestionMediaProps {
  imgUrl?: string;
  videoUrl?: string;
  altText?: string;
}

export function QuestionMedia({ imgUrl, videoUrl, altText = "Image" }: QuestionMediaProps) {
  const videoUrlWithParams = videoUrl ? getVideoUrlWithParams(videoUrl) : undefined;
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="fb-group/image fb-relative fb-mb-6 fb-block fb-min-h-40 fb-rounded-md">
      {isLoading ? (
        <div className="fb-absolute fb-inset-auto fb-flex fb-h-full fb-w-full fb-animate-pulse fb-items-center fb-justify-center fb-rounded-md fb-bg-slate-200" />
      ) : null}
      {imgUrl ? (
        <img
          key={imgUrl}
          src={imgUrl}
          alt={altText}
          className={cn(
            "fb-rounded-custom fb-max-h-[40dvh] fb-mx-auto fb-object-contain",
            isLoading ? "fb-opacity-0" : ""
          )}
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={() => {
            setIsLoading(false);
          }}
        />
      ) : null}
      {videoUrlWithParams ? (
        <div className="fb-relative">
          <div className="fb-rounded-custom fb-bg-black">
            <iframe
              src={videoUrlWithParams}
              title="Question Video"
              frameBorder="0"
              className={cn("fb-rounded-custom fb-aspect-video fb-w-full", isLoading ? "fb-opacity-0" : "")}
              onLoad={() => {
                setIsLoading(false);
              }}
              onError={() => {
                setIsLoading(false);
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : null}
      <a
        href={imgUrl ? imgUrl : convertToEmbedUrl(videoUrl ?? "")}
        target="_blank"
        rel="noreferrer"
        aria-label={"Open in new tab"}
        className="fb-absolute fb-bottom-2 fb-right-2 fb-flex fb-items-center fb-gap-2 fb-rounded-md fb-bg-slate-800 fb-bg-opacity-40 fb-p-1.5 fb-text-white fb-opacity-0 fb-backdrop-blur-lg fb-transition fb-duration-300 fb-ease-in-out hover:fb-bg-opacity-65 group-hover/image:fb-opacity-100">
        {imgUrl ? <ImageDownIcon size={20} /> : <ExpandIcon size={20} />}
      </a>
    </div>
  );
}
