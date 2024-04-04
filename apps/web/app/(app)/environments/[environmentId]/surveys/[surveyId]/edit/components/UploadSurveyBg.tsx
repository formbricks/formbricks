import { getImagesFromUnsplashAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { debounce } from "lodash";
import { SearchIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { getAllowedFiles, uploadFile } from "@formbricks/ui/FileInput/lib/fileUpload";
import { Input } from "@formbricks/ui/Input";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

interface ImageFromThirdPartySurveyBgProps {
  handleBgChange: (url: string, bgType: string) => void;
  environmentId: string;
}

interface Image {
  id: string;
  alt_description: string;
  urls: {
    regular: string;
  };
}

export const ImageFromThirdPartySurveyBg = ({
  environmentId,
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

  const uploadSelectedImage = async (files: File[]) => {
    if (files.length > 1) {
      files = [files[0]];
      toast.error("Only one file is allowed");
    }
    const allowedFileExtensions = ["png", "jpeg", "jpg"];

    const allowedFiles = getAllowedFiles(files, allowedFileExtensions, 2);

    if (allowedFiles.length === 0) {
      return;
    }

    const uploadedFiles = await Promise.allSettled(
      allowedFiles.map((file) => uploadFile(file, allowedFileExtensions, environmentId))
    );

    if (
      uploadedFiles.length < allowedFiles.length ||
      uploadedFiles.some((file) => file.status === "rejected")
    ) {
      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded");
      } else {
        toast.error("Some files failed to upload");
      }
    }

    const uploadedUrls: string[] = [];

    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(encodeURI(file.value.url));
      }
    });

    if (uploadedUrls.length > 0) {
      handleBgChange(uploadedUrls[0], "upload");
    } else {
      handleBgChange("", "upload");
    }
  };

  const handleImageSelected = async (imageUrl: string, imageName: string) => {
    try {
      setUploading(true);
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const file = [new File([blob], `${imageName}.jpg`, { type: blob.type })];
      await uploadSelectedImage(file);
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
          <div className="absolute inset-0 m-1 flex items-center justify-center">
            <LoadingSpinner />
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
                onClick={() => handleImageSelected(image.urls.regular, image.alt_description)}
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
