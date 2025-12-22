import { Download, ExternalLink } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { checkForLoomUrl, checkForVimeoUrl, checkForYoutubeUrl, convertToEmbedUrl } from "@/lib/video";

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

interface ElementMediaProps {
  imgUrl?: string;
  videoUrl?: string;
  altText?: string;
}

function ElementMedia({ imgUrl, videoUrl, altText = "Image" }: Readonly<ElementMediaProps>): React.ReactNode {
  const videoUrlWithParams = videoUrl ? getVideoUrlWithParams(videoUrl) : undefined;
  const [isLoading, setIsLoading] = React.useState(true);

  if (!imgUrl && !videoUrl) {
    return null;
  }

  return (
    <div className="group/image relative mb-6 block min-h-40 rounded-md">
      {isLoading ? (
        <div className="absolute inset-auto flex h-full w-full animate-pulse items-center justify-center rounded-md bg-slate-200" />
      ) : null}
      {imgUrl ? (
        <img
          key={imgUrl}
          src={imgUrl}
          alt={altText}
          className={cn("mx-auto max-h-[40dvh] rounded-md object-contain", isLoading ? "opacity-0" : "")}
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={() => {
            setIsLoading(false);
          }}
        />
      ) : null}
      {videoUrlWithParams ? (
        <div className="relative">
          <div className="rounded-md bg-black">
            <iframe
              src={videoUrlWithParams}
              title="Question video"
              style={{ border: 0 }}
              className={cn("aspect-video w-full rounded-md", isLoading ? "opacity-0" : "")}
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
        href={imgUrl ?? convertToEmbedUrl(videoUrl ?? "")}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in new tab"
        className="bg-opacity-40 hover:bg-opacity-65 absolute right-2 bottom-2 flex items-center gap-2 rounded-md bg-slate-800 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out group-hover/image:opacity-100">
        {imgUrl ? <Download size={20} /> : <ExternalLink size={20} />}
      </a>
    </div>
  );
}

export { ElementMedia };
export type { ElementMediaProps };
