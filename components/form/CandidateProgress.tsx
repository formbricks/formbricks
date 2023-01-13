import { useState, useEffect } from "react";
import {
  CheckCircleIcon,
  EllipsisHorizontalCircleIcon,
} from "@heroicons/react/24/outline";
import usePages from "../../hooks/usePages";
import { getFormState } from "../../lib/utils";
import { useSession } from "next-auth/react";
import { useNoCodeFormPublic } from "../../lib/noCodeForm";

function CandidateProgress({ form }) {
  const [progress, setProgress] = useState(0);
  const { candidateSubmissions } = useNoCodeFormPublic(form.id);
  const pages = usePages({ blocks: form.noCodeForm.blocks, formId: form.id });
  const session = useSession();
  const { user } = session.data;
  const { questionsCounter, responsesCounter } = getFormState(
    pages,
    candidateSubmissions,
    user
  );

  const candidateProgress = async () => {
    try {
      const progress = await fetch(`/api/public/forms/${form.id}/nocodeform`, {
        method: "GET",
      });

      if (progress && !progress.ok) {
        console.error("error");
      }
      const data = await progress.json();
      setProgress(data ? data.events.length : 0);
    } catch (error) {}
  };

  useEffect(() => {
    candidateProgress();
  }, []);

  return (
    <div
      className={
        progress < pages.length - 1
          ? "flex items-center px-6 py-1 text-base font-normal text-black-title"
          : "flex items-center px-6 py-1 text-base font-normal text-green-700"
      }
    >
      {!(progress < pages.length - 1) &&
      questionsCounter === responsesCounter ? (
        <span className='flex items-center mr-1'>
          <CheckCircleIcon
            className={
              progress < pages.length - 1
                ? "w-5 h-5 text-rose-500 mr-2"
                : "w-5 h-5 text-green-700 mr-2"
            }
          />
          Terminé
        </span>
      ) : !(progress < pages.length - 1) && responsesCounter > 0 ? (
        <span className='flex items-center text-orange-600 mr-1'>
          <EllipsisHorizontalCircleIcon
            className={
              progress < pages.length - 1
                ? "w-5 h-5 text-rose-500 mr-2"
                : "w-5 h-5 text-orange-600 mr-2"
            }
          />
          {"Continuer"}
        </span>
      ) : (
        <span className='flex items-center text-black mr-1'>
          <EllipsisHorizontalCircleIcon
            className={"w-5 h-5 text-rose-500 mr-2"}
          />
          Commencer
        </span>
      )}
    </div>
  );
}

export default CandidateProgress;
