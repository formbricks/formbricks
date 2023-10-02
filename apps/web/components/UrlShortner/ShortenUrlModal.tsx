import React, { useEffect, useState } from "react";
import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { useForm } from "react-hook-form";
import { LinkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { getShortUrl } from "@/app/(app)/environments/[environmentId]/actions";

interface ShortenUrlModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const SURVEY_BASE_URL = "https://formbricks.com/i/";

const ShortenUrlModal = ({ open, setOpen }: ShortenUrlModalProps) => {
  const [loading, setLoading] = useState(false);

  const [shortenUrl, setShortenUrl] = useState("");

  const { register, handleSubmit, reset } = useForm({
    mode: "onBlur",
  });

  const submitUrl = async (data: { url: string }) => {
    try {
      setLoading(true);
      const url = await getShortUrl(data.url);
      if (url) {
        setShortenUrl(url);
      }
    } catch (_) {
      toast.error("Unable to create url!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reset();
    setShortenUrl("");
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
                <div className="text-xl font-medium text-slate-700">URL shortner</div>
                <div className="text-sm text-slate-500">Create a short URL to make params less obvious.</div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitUrl)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6 text-sm">
            <div className="grid w-full grid-cols-5 gap-x-2 gap-y-4">
              <div className="col-span-4">
                <Label>Paste URL</Label>
                <Input
                  className="h-11"
                  autoFocus
                  placeholder="https://formbricks.com/c..."
                  {...register("url", {
                    required: true,
                    validate: (value) =>
                      value.startsWith(SURVEY_BASE_URL) || toast.error("Only formbricks links allowed."),
                  })}
                />
              </div>
              <Button type="submit" loading={loading} className="h-11 self-end" variant="darkCTA">
                Shorten
              </Button>
              <div className="col-span-4">
                <Label>Short URL</Label>
                <div className="relative flex h-11 max-w-full items-center overflow-auto rounded-lg border border-slate-300 bg-slate-50 px-4 text-slate-800">
                  <span
                    style={{
                      wordBreak: "break-all",
                    }}>
                    {shortenUrl}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => navigator.clipboard.writeText(shortenUrl)}
                className="flex h-11 justify-center self-end"
                variant="secondary">
                Copy
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ShortenUrlModal;
