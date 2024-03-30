import { getImageBackground } from "@/app/s/[surveyId]/actions";
import { debounce } from "lodash";
import { Loader, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Input } from "@formbricks/ui/Input";

interface UploadSurveyBgProps {
  handleBgChange: (url: string, bgType: string) => void;
  background: string;
}

interface Image {
  id: string;
  alt_description: string;
  urls: {
    regular: string;
  };
}

export const UploadSurveyBg = ({ handleBgChange, background }: UploadSurveyBgProps) => {
  const inputFocus = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<Image[]>([]);

  useEffect(() => {
    const fetchData = async (searchQuery: string) => {
      try {
        setLoading(true);
        const data = await getImageBackground(searchQuery);
        setImages(data.results);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
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
      <div className="relative mt-4 grid grid-cols-3 gap-1">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader />
          </div>
        ) : (
          images.map((image) => (
            <Image
              key={image.id}
              width={300}
              height={200}
              src={images.length > 0 ? image.urls.regular : background}
              alt={image.alt_description}
              onClick={() => handleBgChange(image.urls?.regular, "upload")}
              className="cursor-pointer rounded-lg"
            />
          ))
        )}
      </div>
    </div>
  );
};
