import { useState } from "react";
import { cn } from "@formbricks/lib/cn";
import type { RatingQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";
import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as FilledStarIcon } from "@heroicons/react/24/solid";

interface RatingQuestionProps {
  question: RatingQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function RatingQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: RatingQuestionProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hoveredNumber, setHoveredNumber] = useState(0);
  // const icons = RatingSmileyList(question.range);

  const handleSelect = (number: number) => {
    setSelectedChoice(number);
    if (question.required) {
      onSubmit({
        [question.id]: number,
      });
      setSelectedChoice(null); // reset choice
    }
  };

  const HiddenRadioInput = ({ number }) => (
    <input
      type="radio"
      name="rating"
      value={number}
      className="absolute h-full w-full cursor-pointer opacity-0"
      onChange={() => handleSelect(number)}
      required={question.required}
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const data = {
          [question.id]: selectedChoice,
        };

        setSelectedChoice(null); // reset choice

        onSubmit(data);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset className="max-w-full">
          <legend className="sr-only">Options</legend>

          <div className="flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="relative max-h-10 flex-1 cursor-pointer bg-white text-center text-sm leading-10">
                {question.scale === "number" ? (
                  <label
                    className={cn(
                      selectedChoice === number ? "z-10 border-slate-400 bg-slate-50" : "",
                      a.length === number ? "rounded-r-md" : "",
                      number === 1 ? "rounded-l-md" : "",
                      "box-border block h-full w-full border hover:bg-gray-100 focus:outline-none"
                    )}>
                    <HiddenRadioInput number={number} />
                    {number}
                  </label>
                ) : question.scale === "star" ? (
                  <label
                    className={cn(
                      number <= hoveredNumber ? "text-yellow-500" : "",
                      "flex h-full w-full justify-center"
                    )}>
                    <HiddenRadioInput number={number} />
                    {selectedChoice && selectedChoice >= number ? (
                      <FilledStarIcon className="max-h-full text-yellow-300" />
                    ) : (
                      <StarIcon className="max-h-full " />
                    )}
                  </label>
                ) : (
                  <label className="flex h-full w-full justify-center">
                    <HiddenRadioInput number={number} />
                    <RatingSmiley
                      active={selectedChoice == number || hoveredNumber == number}
                      idx={i}
                      range={question.range}
                    />
                  </label>
                )}
              </span>
            ))}
          </div>

          <div className="flex justify-between px-1.5 text-xs leading-6 text-slate-500">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      {!question.required && (
        <div className="mt-4 flex w-full justify-between">
          <div></div>
          <button
            type="submit"
            className="flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            style={{ backgroundColor: brandColor }}>
            {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
          </button>
        </div>
      )}
    </form>
  );
}

interface RatingSmileyProps {
  active: boolean;
  idx: number;
  range: number;
}

function RatingSmiley({ active, idx, range }: RatingSmileyProps): JSX.Element {
  const activeColor = "fill-yellow-500";
  const inactiveColor = "fill-none";
  let icons = [
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m21.88 23.92c5.102-0.06134 7.273-1.882 8.383-3.346"
        />
        <path
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m46.24 47.56c0-2.592-2.867-7.121-10.25-6.93-6.974 0.1812-10.22 4.518-10.22 7.111s4.271-1.611 10.05-1.492c6.317 0.13 10.43 3.903 10.43 1.311z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m23.16 28.47c5.215 1.438 5.603 0.9096 8.204 1.207 1.068 0.1221-2.03 2.67-7.282 4.397"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m50.12 23.92c-5.102-0.06134-7.273-1.882-8.383-3.346"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m48.84 28.47c-5.215 1.438-5.603 0.9096-8.204 1.207-1.068 0.1221 2.03 2.67 7.282 4.397"
        />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m22.88 23.92c5.102-0.06134 7.273-1.882 8.383-3.346"
        />
        <path
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m46.24 47.56c0-2.592-2.867-7.121-10.25-6.93-6.974 0.1812-10.22 4.518-10.22 7.111s4.271-1.611 10.05-1.492c6.317 0.13 10.43 3.903 10.43 1.311z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m49.12 23.92c-5.102-0.06134-7.273-1.882-8.383-3.346"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m48.24 30.51c-6.199 1.47-7.079 1.059-8.868-1.961"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="m23.76 30.51c6.199 1.47 7.079 1.059 8.868-1.961"
        />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <line
          x1="44.5361"
          x2="50.9214"
          y1="21.4389"
          y2="24.7158"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <line
          x1="26.9214"
          x2="20.5361"
          y1="21.4389"
          y2="24.7158"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M24,28c2.3334,1.3333,4.6666,2.6667,7,4c-2.3334,1.3333-4.6666,2.6667-7,4"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M48,28c-2.3334,1.3333-4.6666,2.6667-7,4c2.3334,1.3333,4.6666,2.6667,7,4"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M28,51c0.2704-0.3562,1-8,8.4211-8.0038C43,42.9929,43.6499,50.5372,44,51C38.6667,51,33.3333,51,28,51z"
        />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M26.5,48c1.8768-3.8326,5.8239-6.1965,10-6c3.8343,0.1804,7.2926,2.4926,9,6"
        />
        <path d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" />
        <path d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m44.7 43.92c-6.328-1.736-11.41-0.906-17.4 1.902"
        />
        <path d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" />
        <path d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          className={active ? activeColor : inactiveColor}
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <line
          x1="27"
          x2="45"
          y1="43"
          y2="43"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-miterlimit="10"
          stroke-width="2"
        />
        <path d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" />
        <path d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M45.8149,44.9293 c-2.8995,1.6362-6.2482,2.5699-9.8149,2.5699s-6.9153-0.9336-9.8149-2.5699"
        />
        <path d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" />
        <path d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M45.8147,45.2268a15.4294,15.4294,0,0,1-19.6294,0"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M31.6941,33.4036a4.7262,4.7262,0,0,0-8.6382,0"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M48.9441,33.4036a4.7262,4.7262,0,0,0-8.6382,0"
        />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M50.595,41.64a11.5554,11.5554,0,0,1-.87,4.49c-12.49,3.03-25.43.34-27.49-.13a11.4347,11.4347,0,0,1-.83-4.36h.11s14.8,3.59,28.89.07Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M49.7251,46.13c-1.79,4.27-6.35,7.23-13.69,7.23-7.41,0-12.03-3.03-13.8-7.36C24.2951,46.47,37.235,49.16,49.7251,46.13Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M31.6941,32.4036a4.7262,4.7262,0,0,0-8.6382,0"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-miterlimit="10"
          stroke-width="2"
          d="M48.9441,32.4036a4.7262,4.7262,0,0,0-8.6382,0"
        />
      </g>
    </svg>,
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <g id="line">
        <polyline
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          points="25.168 27.413 31.755 31.427 25.168 35.165"
        />
        <polyline
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          points="46.832 27.413 40.245 31.427 46.832 35.165"
        />
        <circle
          className={active ? activeColor : inactiveColor}
          cx="36"
          cy="36"
          r="23"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M50.595,41.64a11.5554,11.5554,0,0,1-.87,4.49c-12.49,3.03-25.43.34-27.49-.13a11.4347,11.4347,0,0,1-.83-4.36h.11s14.8,3.59,28.89.07Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M49.7251,46.13c-1.79,4.27-6.35,7.23-13.69,7.23-7.41,0-12.03-3.03-13.8-7.36C24.2951,46.47,37.235,49.16,49.7251,46.13Z"
        />
      </g>
    </svg>,
  ];

  if (range == 7) icons = [icons[1], icons[3], icons[4], icons[5], icons[6], icons[8], icons[9]];
  else if (range == 5) icons = [icons[3], icons[4], icons[5], icons[6], icons[7]];
  else if (range == 4) icons = [icons[4], icons[5], icons[6], icons[7]];
  else if (range == 3) icons = [icons[4], icons[5], icons[7]];
  return icons[idx];
}
