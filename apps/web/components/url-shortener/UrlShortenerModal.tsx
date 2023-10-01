import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { LinkIcon } from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import clsx from "clsx";
import { createShortUrlAction } from "./actions";
import { env } from "@/env.mjs";

interface UrlShortenerModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

type UrlValidationStates = "default" | "valid" | "invalid";

type UrlShortenerFormDataProps = {
  url: string;
};

export default function UrlShortenerModal({ open, setOpen }: UrlShortenerModalProps) {
  const [isShorteningUrl, setIsShorteningUrl] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [urlValidationState, setUrlValidationState] = useState<UrlValidationStates>("default");
  const [shortUrl, setShortUrl] = useState("https://formbricks.com/c...");
  const { register, handleSubmit, watch } = useForm<UrlShortenerFormDataProps>({
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

    const regexPattern = new RegExp("^" + env.NEXT_PUBLIC_SURVEY_BASE_URL);
    const isValid = regexPattern.test(value);
    if (!isValid) {
      setUrlValidationState("invalid");
      toast.error("Only formbricks links allowed.");
    } else {
      setUrlValidationState("valid");
    }
  };

  const shortenUrl = async (data: UrlShortenerFormDataProps) => {
    if (urlValidationState !== "valid") return;
    console.log({ data });

    setIsShorteningUrl(true);

    const shortUrl = await createShortUrlAction(data.url);
    setShortUrl(shortUrl);

    setIsShorteningUrl(false);
  };

  const linkTextRef = useRef(null);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const copyUrl = () => {
    setIsCopying(true);
    new Promise((resolve) => setTimeout(resolve, 3000));
    navigator.clipboard.writeText("https://formbricks.com/c...");
    toast.success("URL copied to clipboard!");
    setIsCopying(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
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
                placeholder="https://formbricks.com/c..."
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
                loading={isShorteningUrl}>
                Shorten
              </Button>
            </div>
          </div>
        </form>
        <div className="grid w-full space-y-2 rounded-lg px-6 py-4">
          <Label>Short URL</Label>
          <div className="grid grid-cols-6 gap-3">
            <div
              ref={linkTextRef}
              className="col-span-5 w-full overflow-auto rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              onClick={() => handleTextSelection()}>
              <span
                style={{
                  wordBreak: "break-all",
                }}>
                {shortUrl}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="col-span-1 flex items-center justify-center"
              type="submit"
              loading={isCopying}
              onClick={copyUrl}>
              <span>Copy</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
