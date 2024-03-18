import { LinkIcon } from "lucide-react";

import { Modal } from "@formbricks/ui/Modal";

import UrlShortenerForm from "./UrlShortenerForm";

type UrlShortenerModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  webAppUrl: string;
};

export default function UrlShortenerModal({ open, setOpen, webAppUrl }: UrlShortenerModalProps) {
  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg pb-4">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <LinkIcon className="h-5 w-5" />
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
        <UrlShortenerForm webAppUrl={webAppUrl} />
      </div>
    </Modal>
  );
}
