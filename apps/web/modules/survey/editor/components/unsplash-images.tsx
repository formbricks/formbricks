"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { useTranslate } from "@tolgee/react";
import { debounce } from "lodash";
import { SearchIcon } from "lucide-react";
import UnsplashImage from "next/image";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TSurveyBackgroundBgType } from "@formbricks/types/surveys/types";
import { getImagesFromUnsplashAction, triggerDownloadUnsplashImageAction } from "../actions";

interface ImageFromUnsplashSurveyBgProps {
  handleBgChange: (url: string, bgType: TSurveyBackgroundBgType) => void;
}

interface UnsplashImage {
  id: string;
  alt_description: string;
  urls: {
    regularWithAttribution: string;
    download?: string;
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
  {
    id: "windows",
    alt_description: "Windows",
    urls: {
      regularWithAttribution: "/image-backgrounds/windows.webp",
    },
  },
];

export const ImageFromUnsplashSurveyBg = ({ handleBgChange }: ImageFromUnsplashSurveyBgProps) => {
  const { t } = useTranslate();
  const inputFocus = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<UnsplashImage[]>(defaultImages);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchData = async (searchQuery: string, currentPage: number) => {
      try {
        setIsLoading(true);
        const getImagesFromUnsplashResponse = await getImagesFromUnsplashAction({
          searchQuery: searchQuery,
          page: currentPage,
        });
        if (!getImagesFromUnsplashResponse?.data) return;

        const imagesFromUnsplash = getImagesFromUnsplashResponse.data;
        for (let i = 0; i < imagesFromUnsplash.length; i++) {
          const authorName = new URL(imagesFromUnsplash[i].urls.regularWithAttribution).searchParams.get(
            "authorName"
          );
          imagesFromUnsplash[i].authorName = authorName;
        }
        setImages((prevImages) => [...prevImages, ...imagesFromUnsplash]);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    const debouncedFetchData = debounce((q) => fetchData(q, page), 500);

    if (query.trim() !== "") {
      debouncedFetchData(query);
    }

    return () => {
      debouncedFetchData.cancel();
    };
  }, [query, page, setImages]);

  useEffect(() => {
    inputFocus.current?.focus();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setPage(1);
    setImages([]);
  };

  const handleImageSelected = async (imageUrl: string, downloadImageUrl?: string) => {
    try {
      handleBgChange(imageUrl, "image");
      if (downloadImageUrl) {
        await triggerDownloadUnsplashImageAction({ downloadUrl: downloadImageUrl });
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLoadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <div className="relative mt-2 w-full">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2 h-6 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder={t("environments.surveys.edit.try_lollipop_or_mountain")}
          className="pl-8"
          ref={inputFocus}
          aria-label={t("environments.surveys.edit.search_for_images")}
        />
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-1">
        {images.length > 0 &&
          images.map((image) => (
            <div key={image.id} className="group relative">
              <UnsplashImage
                width={300}
                height={200}
                src={image.urls.regularWithAttribution}
                alt={image.alt_description}
                onClick={() => handleImageSelected(image.urls.regularWithAttribution, image.urls.download)}
                className="h-full cursor-pointer rounded-lg object-cover"
              />
              {image.authorName && (
                <span className="bg-opacity-75 absolute right-1 bottom-1 hidden rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
                  {image.authorName}
                </span>
              )}
            </div>
          ))}
        {isLoading && (
          <div className="col-span-3 flex items-center justify-center p-3">
            <LoadingSpinner />
          </div>
        )}
        {images.length > 0 && !isLoading && query.trim() !== "" && (
          <Button
            size="sm"
            variant="secondary"
            className="col-span-3 mt-3 flex items-center justify-center"
            type="button"
            onClick={handleLoadMore}>
            {t("common.load_more")}
          </Button>
        )}
        {!isLoading && images.length === 0 && query.trim() !== "" && (
          <div className="col-span-3 flex items-center justify-center text-sm text-slate-500">
            {t("environments.surveys.edit.no_images_found_for", { query: query })}
          </div>
        )}
      </div>
    </div>
  );
};
