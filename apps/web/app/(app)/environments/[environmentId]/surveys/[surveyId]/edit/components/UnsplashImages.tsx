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
    regularWithAttribution: string;
  };
  authorName?: string;
}

const defaultImages = [
  {
    id: "dog-1",
    alt_description: "Dog",
    urls: {
      regularWithAttribution: "/image-backgrounds/dogs.webp",
    },
  },
  {
    id: "pencil",
    alt_description: "Pencil",
    urls: {
      regularWithAttribution: "/image-backgrounds/pencil.webp",
    },
  },
  {
    id: "plant",
    alt_description: "Plant",
    urls: {
      regularWithAttribution: "/image-backgrounds/plant.webp",
    },
  },
  {
    id: "dog-2",
    alt_description: "Another Dog",
    urls: {
      regularWithAttribution: "/image-backgrounds/dog-2.webp",
    },
  },
  {
    id: "kitten-2",
    alt_description: "Another Kitten",
    urls: {
      regularWithAttribution: "/image-backgrounds/kitten-2.webp",
    },
  },
  {
    id: "lollipop",
    alt_description: "Lollipop",
    urls: {
      regularWithAttribution: "/image-backgrounds/lolipop.webp",
    },
  },
  {
    id: "oranges",
    alt_description: "Oranges",
    urls: {
      regularWithAttribution: "/image-backgrounds/oranges.webp",
    },
  },
  {
    id: "flower",
    alt_description: "Flower",
    urls: {
      regularWithAttribution: "/image-backgrounds/flowers.webp",
    },
  },
  {
    id: "supermario",
    alt_description: "Super Mario",
    urls: {
      regularWithAttribution: "/image-backgrounds/supermario.webp",
    },
  },
  {
    id: "shapes",
    alt_description: "Shapes",
    urls: {
      regularWithAttribution: "/image-backgrounds/shapes.webp",
    },
  },
  {
    id: "waves",
    alt_description: "Waves",
    urls: {
      regularWithAttribution: "/image-backgrounds/waves.webp",
    },
  },
  {
    id: "kitten-1",
    alt_description: "Kitten",
    urls: {
      regularWithAttribution: "/image-backgrounds/kittens.webp",
    },
  },
];

export const ImageFromUnsplashSurveyBg = ({ handleBgChange }: ImageFromUnsplashSurveyBgProps) => {
  const inputFocus = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<UnsplashImage[]>(defaultImages);

  useEffect(() => {
    const fetchData = async (searchQuery: string) => {
      try {
        setIsLoading(true);
        const imagesFromUnsplash = await getImagesFromUnsplashAction(searchQuery);
        for (let i = 0; i < imagesFromUnsplash.length; i++) {
          const authorName = new URL(imagesFromUnsplash[i].urls.regularWithAttribution).searchParams.get(
            "authorName"
          );
          imagesFromUnsplash[i].authorName = authorName;
        }
        setImages(imagesFromUnsplash);
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
          placeholder="Try 'lollipop' or 'mountain'..."
          className="pl-8"
          ref={inputFocus}
          aria-label="Search for images"
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
              <div key={image.id} className="group relative">
                <UnsplashImage
                  width={300}
                  height={200}
                  src={image.urls.regularWithAttribution}
                  alt={image.alt_description}
                  onClick={() => handleImageSelected(image.urls.regularWithAttribution)}
                  className="h-full cursor-pointer rounded-lg object-cover"
                />
                {image.authorName && (
                  <span className="absolute bottom-1 right-1 hidden rounded bg-black bg-opacity-75 px-2 py-1 text-xs text-white group-hover:block">
                    {image.authorName}
                  </span>
                )}
              </div>
            ))
          : !isLoading &&
            query.trim() !== "" && (
              <div className="col-span-3 flex items-center justify-center text-sm text-slate-500">
                No images found for &apos;{query}&apos;
              </div>
            )}
      </div>
    </div>
  );
};
