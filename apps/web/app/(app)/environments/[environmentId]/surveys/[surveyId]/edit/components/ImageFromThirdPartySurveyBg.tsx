"use client";

import { getImagesFromUnsplashAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { debounce } from "lodash";
import { CheckCheckIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { TSurveyStyling } from "@formbricks/types/surveys";
import { uploadFile } from "@formbricks/ui/FileInput/lib/utils";
import { Input } from "@formbricks/ui/Input";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

interface ImageFromThirdPartySurveyBgProps {
  background: string;
  handleBgChange: (url: string, bgType: string) => void;
}

interface Image {
  id: string;
  alt_description: string;
  urls: {
    regular: string;
  };
}

export const saveUnsplashImageToFormbricks = async (environmentId: string, styling: TSurveyStyling) => {
  if (styling?.background?.bgType === "image" && styling.background.bg?.includes("images.unsplash.com")) {
    try {
      const blob = await fetch(styling.background.bg).then((res) => res.blob());
      const file = new File(
        [blob],
        `${"unsplash-" + new URL(styling.background.bg).pathname.split("/").pop()}.jpg`,
        {
          type: blob.type,
        }
      );
      const { uploaded, url } = await uploadFile(file, ["png", "jpeg", "jpg"], environmentId);
      if (!uploaded) throw new Error();
      return url;
    } catch {
      toast.error("Unable to set background image, please try again");
    }
  }
};

export const ImageFromThirdPartySurveyBg = ({
  background,
  handleBgChange,
}: ImageFromThirdPartySurveyBgProps) => {
  const inputFocus = useRef<HTMLInputElement>(null);
  const [downloadingFromThirdParty, setDownloadingFromThirdParty] = useState(false);
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async (searchQuery: string) => {
      try {
        setDownloadingFromThirdParty(true);
        const data = await getImagesFromUnsplashAction(searchQuery);
        setImages(data.results);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setDownloadingFromThirdParty(false);
      }
    };

    const debouncedFetchData = debounce(fetchData, 500);

    if (query.trim() !== "") {
      debouncedFetchData(query);
    }

    return () => {
      debouncedFetchData.cancel();
    };
  }, [query, setImages]);

  useEffect(() => {
    inputFocus.current?.focus();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleImageSelected = async (imageUrl: string) => {
    try {
      setUploading(true);
      handleBgChange(imageUrl, "image");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative mt-2 w-full">
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 h-6 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Search free high-resolution photos from Unsplash"
          className="pl-8"
          ref={inputFocus}
        />
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-1">
        {downloadingFromThirdParty && (
          <div className="col-span-3 flex items-center justify-center p-4">
            <LoadingSpinner />
          </div>
        )}
        {background && !background.includes("images.unsplash.com") && (
          <div className="relative cursor-pointer rounded-lg" onClick={() => handleImageSelected(background)}>
            <Image
              width={300}
              height={200}
              src={background}
              alt="Selected Background"
              className="rounded-lg"
            />
            <div className="absolute right-0 top-0 flex h-full w-full items-center justify-center bg-black bg-opacity-40">
              <CheckCheckIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        )}

        {images.length > 0
          ? images.map((image) => (
              <Image
                key={image.id}
                width={300}
                height={200}
                src={image.urls.regular}
                alt={image.alt_description}
                onClick={() => handleImageSelected(image.urls.regular)}
                className="cursor-pointer rounded-lg"
              />
            ))
          : !downloadingFromThirdParty &&
            query.trim() !== "" && (
              <div className="col-span-3 flex items-center justify-center text-sm text-slate-500">
                No images found!
              </div>
            )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-300 bg-opacity-60 p-1">
            <LoadingSpinner />
          </div>
        )}
      </div>
    </div>
  );
};
