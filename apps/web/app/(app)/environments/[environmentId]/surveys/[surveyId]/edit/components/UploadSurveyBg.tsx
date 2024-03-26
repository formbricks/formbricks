import { debounce } from "lodash";
import { SearchIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { Input } from "@formbricks/ui/Input";

interface UploadSurveyBgProps {
  handleBgChange: (url: string, bgType: string) => void;
  query: string;
  images: Image[];
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setImages: React.Dispatch<React.SetStateAction<Image[]>>;
}

interface Image {
  id: string;
  alt_description: string;
  urls: {
    regular: string;
  };
}

export const UploadSurveyBg = ({
  handleBgChange,
  query,
  setQuery,
  images,
  setImages,
}: UploadSurveyBgProps) => {
  const inputFocus = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async (searchQuery: string) => {
      const accessKey = "";
      try {
        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${searchQuery}&client_id=${accessKey}&orientation=landscape&w=1920&h=1080`
        );
        const data = await response.json();
        setImages(data.results);
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };

    const debouncedFetchData = debounce(fetchData, 500);

    if (query.trim() !== "") {
      debouncedFetchData(query);
    }

    return () => {
      debouncedFetchData.cancel();
    };
  }, [query]);

  useEffect(() => {
    inputFocus.current?.focus();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <div className="relative mt-2 w-full">
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 h-6 w-4 -translate-y-[50%] text-gray-400" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Search free high-resolution photos from Unsplash"
          className="pl-8"
          ref={inputFocus}
        />
      </div>
      <div className="mt-4 grid cursor-pointer grid-cols-3  gap-1">
        {images.map((image) => (
          <Image
            key={image.id}
            width={300}
            height={200}
            src={image.urls.regular}
            alt={image.alt_description}
            onClick={() => handleBgChange(image.urls.regular, "upload")}
            className="rounded-lg"
          />
        ))}
      </div>
    </div>
  );
};
