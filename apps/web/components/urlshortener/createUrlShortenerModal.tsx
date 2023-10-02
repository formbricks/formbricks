"use client";
import { createShortUrl } from "@/app/(app)/environments/[environmentId]/actions";
import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { LinkIcon } from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

interface CreateUrlShortenerModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  surveyBaseUrl: string;
}

export default function CreateUrlShortenerModal({
  open,
  setOpen,
  surveyBaseUrl,
}: CreateUrlShortenerModalProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const [shortenedUrl, setShortenedUrl] = useState("");

  const submitURL = async (data) => {
    if (!data.url.startsWith(surveyBaseUrl)) {
      toast.error("Only formbricks links allowed");
      return;
    }
    setLoading(true);

    const shortUrl = await createShortUrl(data.url.trim());
    setShortenedUrl(shortUrl);
    toast.success("Short URL created successfully!");
    setLoading(false);
  };

  useEffect(() => {
    setShortenedUrl("");
    reset();
  }, [open]);

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <LinkIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">URL shortener</div>
                <div className="text-sm text-slate-500">
                  Create short URL to make URL params less obvious.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitURL)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6">
            <div className="grid w-full gap-x-2 gap-y-4">
              <div>
                <Label>Paste URL</Label>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    className="col-span-4 "
                    autoFocus
                    placeholder="https://formbricks.com/i/.."
                    {...register("url", { required: true })}
                  />
                  <Button type="submit" loading={loading} className="h-10" variant="darkCTA">
                    Shorten
                  </Button>
                </div>
              </div>
              <div>
                <Label>Short URL</Label>
                <div className="grid grid-cols-5 gap-2">
                  <div
                    className="relative col-span-4 flex h-10 max-w-full items-center overflow-auto rounded-md border border-slate-300 bg-slate-50 pl-3 text-left text-sm text-slate-400"
                    onClick={() => {}}>
                    <span
                      className={`${shortenedUrl ? "text-slate-800" : "text-slate-400"}`}
                      style={{
                        wordBreak: "break-all",
                      }}>
                      {shortenedUrl ? shortenedUrl : "https://formbricks.com/c.."}
                    </span>
                  </div>
                  <Button
                    type="button"
                    className="h-10 justify-center"
                    loading={loading}
                    variant="secondary"
                    onClick={() => {
                      if (!shortenedUrl) {
                        toast.error("Generate short URL to copy");
                        return;
                      }
                      navigator.clipboard.writeText(shortenedUrl);
                      toast.success("URL copied to clipboard!");
                    }}>
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
