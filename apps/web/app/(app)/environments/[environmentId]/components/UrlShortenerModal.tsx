import { Modal } from "@formbricks/ui";
import { Button, Input, Label } from "@formbricks/ui";
import { LinkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { createShortUrlAction } from "../actions";

type UrlShortenerModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  surveyBaseUrl: string;
};
type UrlShortenerFormDataProps = {
  url: string;
};
type UrlValidationState = "default" | "valid" | "invalid";

export default function UrlShortenerModal({ open, setOpen, surveyBaseUrl }: UrlShortenerModalProps) {
  const [urlValidationState, setUrlValidationState] = useState<UrlValidationState>("default");
  const [shortUrl, setShortUrl] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<UrlShortenerFormDataProps>({
    mode: "onSubmit",
    defaultValues: {
      url: "",
    },
  });

  const handleUrlValidation = () => {
    const value = watch("url").trim();
    if (!value) {
      setUrlValidationState("default");
      return;
    }

    const regexPattern = new RegExp("^" + surveyBaseUrl);
    const isValid = regexPattern.test(value);
    if (!isValid) {
      setUrlValidationState("invalid");
      toast.error("Only formbricks survey links allowed.");
    } else {
      setUrlValidationState("valid");
    }
  };

  const shortenUrl = async (data: UrlShortenerFormDataProps) => {
    if (urlValidationState !== "valid") return;

    const shortUrl = await createShortUrlAction(data.url.trim());
    setShortUrl(shortUrl);
  };

  const resetForm = () => {
    setUrlValidationState("default");
    setShortUrl("");
  };

  const copyShortUrlToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <Modal
      open={open}
      setOpen={(v) => {
        setOpen(v);
        resetForm();
      }}
      noPadding
      closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg pb-4">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <LinkIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">URL shortener</div>
                <div className="text-sm text-slate-500">
                  Create a short URL to make URL params less obvious.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(shortenUrl)}>
          <div className="grid w-full space-y-2 rounded-lg px-6 py-4">
            <Label>Paste URL</Label>
            <div className="grid grid-cols-6 gap-3">
              <Input
                autoFocus
                placeholder={`${surveyBaseUrl}...`}
                className={clsx(
                  "col-span-5",
                  urlValidationState === "valid"
                    ? "border-green-500 bg-green-50"
                    : urlValidationState === "invalid"
                    ? "border-red-200 bg-red-50"
                    : urlValidationState === "default"
                    ? "border-slate-200"
                    : "bg-white"
                )}
                {...register("url", {
                  required: true,
                })}
                onBlur={handleUrlValidation}
              />
              <Button
                variant="darkCTA"
                size="sm"
                className="col-span-1 text-center"
                type="submit"
                loading={isSubmitting}>
                Shorten
              </Button>
            </div>
          </div>
        </form>
        <div className="grid w-full space-y-2 rounded-lg px-6 py-4">
          <Label>Short URL</Label>
          <div className="grid grid-cols-6 gap-3">
            <span
              className="col-span-5 cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
              onClick={() => {
                if (shortUrl) {
                  copyShortUrlToClipboard();
                }
              }}>
              {shortUrl}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="col-span-1 justify-center"
              type="button"
              onClick={() => copyShortUrlToClipboard()}>
              <span>Copy</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
