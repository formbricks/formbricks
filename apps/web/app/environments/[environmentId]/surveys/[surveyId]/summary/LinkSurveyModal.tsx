import Modal from "@/components/shared/Modal";
import { Survey } from "@formbricks/types/surveys";
import { CheckIcon } from "@heroicons/react/24/outline";
import { ClipboardDocumentIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";

interface LinkSurveyModalProps {
  survey: Survey;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function LinkSurveyModal({ survey, open, setOpen }: LinkSurveyModalProps) {
  return (
    <Modal open={open} setOpen={setOpen} blur={false}>
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Your survey is ready!</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">Share this link to let people answer your survey:</p>
            <p className="relative mt-3 w-full rounded-lg border border-teal-300 bg-teal-50 p-3 text-center text-slate-800">
              {`${window.location.protocol}//${window.location.host}/s/${survey.id}`}
              <ClipboardDocumentIcon
                className="absolute right-3 top-1/3 h-5 w-5 cursor-pointer text-slate-700 hover:text-slate-900"
                title="Copy survey link to clipboard"
                aria-label="Copy survey link to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.protocol}//${window.location.host}/s/${survey.id}`
                  );
                  toast.success("Copied to clipboard!");
                }}
              />
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
