import { h } from "preact";
import { useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type { RatingQuestion } from "../../../types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";

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
      className="fb-absolute fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0"
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
      <div className="fb-my-4">
        <fieldset>
          <legend className="fb-sr-only">Choices</legend>
          <div className="fb-flex">
            {Array.from({ length: question.range }, (_, i) => i + 1).map((number, i, a) => (
              <span
                key={number}
                onMouseOver={() => setHoveredNumber(number)}
                onMouseLeave={() => setHoveredNumber(0)}
                className="fb-relative fb-max-h-10 fb-flex-1 fb-cursor-pointer fb-bg-white fb-text-center fb-text-sm fb-leading-10">
                {question.scale === "number" ? (
                  <label
                    className={cn(
                      selectedChoice === number ? "fb-z-10 fb-border-slate-400 fb-bg-slate-50" : "",
                      a.length === number ? "fb-rounded-r-md" : "",
                      number === 1 ? "fb-rounded-l-md" : "",
                      "fb-block fb-h-full fb-w-full fb-border hover:fb-bg-gray-100 focus:fb-outline-none"
                    )}>
                    <HiddenRadioInput number={number} />
                    {number}
                  </label>
                ) : question.scale === "star" ? (
                  <label
                    className={cn(
                      number <= hoveredNumber ? "fb-text-yellow-500" : "",
                      "fb-flex fb-h-full fb-w-full fb-justify-center"
                    )}>
                    <HiddenRadioInput number={number} />
                    {selectedChoice && selectedChoice >= number ? (
                      <span className="fb-text-yellow-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="fb-max-h-full fb-h-6 fb-w-6 ">
                          <path
                            fillRule="evenodd"
                            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        className="fb-h-6 fb-max-h-full fb-w-6">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      </svg>
                    )}
                  </label>
                ) : (
                  <label className="fb-flex fb-h-full fb-w-full fb-justify-center fb-fill-yellow-500">
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
          <div className="fb-flex fb-justify-between fb-text-slate-500  fb-leading-6 fb-px-1.5 fb-text-xs">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>
      {!question.required && (
        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
          <div></div>
          <button
            type="submit"
            className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2"
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
  const activeColor = "fb-fill-yellow-500";
  const inactiveColor = "fb-fill-none";
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
          fill="none"
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
          fill="none"
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
        <path
          fill="currentColor"
          d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31"
        />
        <path
          fill="currentColor"
          d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31"
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
          stroke-width="2"
          d="m44.7 43.92c-6.328-1.736-11.41-0.906-17.4 1.902"
        />
        <path
          fill="currentColor"
          d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31"
        />
        <path
          fill="currentColor"
          d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31"
        />
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
        <path
          fill="currentColor"
          d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31"
        />
        <path
          fill="currentColor"
          d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31"
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
          d="M45.8149,44.9293 c-2.8995,1.6362-6.2482,2.5699-9.8149,2.5699s-6.9153-0.9336-9.8149-2.5699"
        />
        <path
          fill="currentColor"
          d="M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31"
        />
        <path
          fill="currentColor"
          d="M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31"
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
