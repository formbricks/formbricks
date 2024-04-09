"use client";

import { getImagesFromUnsplashAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { debounce } from "lodash";
import { SearchIcon } from "lucide-react";
import UnsplashImage from "next/image";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { TSurveyBackgroundBgType } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

interface ImageFromUnsplashSurveyBgProps {
  handleBgChange: (url: string, bgType: TSurveyBackgroundBgType) => void;
}

interface UnsplashImage {
  id: string;
  alt_description: string;
  urls: {
    regular: string;
  };
}

export const ImageFromUnsplashSurveyBg = ({ handleBgChange }: ImageFromUnsplashSurveyBgProps) => {
  const inputFocus = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<UnsplashImage[]>([]);

  useEffect(() => {
    const fetchData = async (searchQuery: string) => {
      try {
        setIsLoading(true);
        const data = await getImagesFromUnsplashAction(searchQuery);
        setImages(data.results);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
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
      handleBgChange(imageUrl, "image");
    } catch (error) {
      toast.error(error.message);
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
        {isLoading && (
          <div className="col-span-3 flex items-center justify-center p-4">
            <LoadingSpinner />
          </div>
        )}
        {images.length > 0
          ? images.map((image) => (
              <UnsplashImage
                key={image.id}
                width={300}
                height={200}
                src={image.urls.regular}
                alt={image.alt_description}
                onClick={() => handleImageSelected(image.urls.regular)}
                className="cursor-pointer rounded-lg"
              />
            ))
          : !isLoading &&
            query.trim() !== "" && (
              <div className="col-span-3 flex items-center justify-center text-sm text-slate-500">
                No images found!
              </div>
            )}
      </div>
    </div>
  );
};
