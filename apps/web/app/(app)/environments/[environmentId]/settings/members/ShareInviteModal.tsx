"use client";

import Modal from "@/components/shared/Modal";

import { Button } from "@formbricks/ui";
import { CheckIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
import { useRef } from "react";
import toast from "react-hot-toast";

interface ShareInviteModalProps {
  inviteToken: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function ShareInviteModal({ inviteToken, open, setOpen }: ShareInviteModalProps) {
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

  return (
    <Modal open={open} setOpen={setOpen} blur={false}>
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Your team invite link is ready!</h3>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Share this link to let your team member join your team:</p>
            <p
              ref={linkTextRef}
              className="relative mt-3 w-full truncate rounded-lg border border-slate-300 bg-slate-50 p-3 text-center text-slate-800"
              onClick={() => handleTextSelection()}>
              {`${window.location.protocol}//${window.location.host}/invite?token=${inviteToken}`}
            </p>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.protocol}//${window.location.host}/invite?token=${inviteToken}`
                );
                toast.success("URL copied to clipboard!");
              }}
              title="Copy invite link to clipboard"
              aria-label="Copy invite link to clipboard"
              EndIcon={DocumentDuplicateIcon}>
              Copy URL
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
