import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

import { createShortUrlAction } from "../actions";

type UrlShortenerFormDataProps = {
  url: string;
};
type UrlValidationState = "default" | "valid" | "invalid";

export default function UrlShortenerForm({ webAppUrl }: { webAppUrl: string }) {
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

    const regexPattern = new RegExp("^" + webAppUrl);
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

  const copyShortUrlToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <div>
      <form onSubmit={handleSubmit(shortenUrl)}>
        <div className="grid w-full space-y-2 rounded-lg px-6 py-4">
          <Label>Paste Survey Link</Label>
          <div className="grid grid-cols-6 gap-3">
            <Input
              autoFocus
              placeholder={`${webAppUrl}...`}
              className={clsx(
                "col-span-5",
                urlValidationState === "valid"
                  ? "border-green-500 bg-green-50"
                  : urlValidationState === "invalid"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200"
              )}
              {...register("url", {
                required: true,
              })}
              onBlur={handleUrlValidation}
            />
            <Button
              disabled={watch("url") === ""}
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
      {shortUrl && (
        <div className="grid w-full space-y-2 rounded-lg px-6 pb-4">
          <Label>Short Link</Label>
          <div className="grid grid-cols-6 gap-3">
            <span
              className="col-span-5 h-10 cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
              onClick={() => {
                if (shortUrl) {
                  copyShortUrlToClipboard();
                }
              }}>
              {shortUrl}
            </span>
            <Button
              disabled={shortUrl === ""}
              variant="secondary"
              size="sm"
              className="col-span-1 justify-center"
              type="button"
              onClick={() => copyShortUrlToClipboard()}>
              <span>Copy</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
