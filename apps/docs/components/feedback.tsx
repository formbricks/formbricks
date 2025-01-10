"use client";

import { Transition } from "@headlessui/react";
import { Fragment, forwardRef, useState } from "react";

function CheckIcon(props: React.ComponentPropsWithoutRef<"svg">): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="10" strokeWidth="0" />
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m6.75 10.813 2.438 2.437c1.218-4.469 4.062-6.5 4.062-6.5"
      />
    </svg>
  );
}

function FeedbackButton(props: Omit<React.ComponentPropsWithoutRef<"button">, "type" | "className">): React.JSX.Element {
  return (
    <button
      type="submit"
      className="hover:bg-zinc-900/2.5 px-3 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      {...props}
    />
  );
}

const FeedbackForm = forwardRef<
  React.ElementRef<"form">,
  Pick<React.ComponentPropsWithoutRef<"form">, "onSubmit">
>(({ onSubmit }, ref): React.JSX.Element => {
  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      className="absolute inset-0 flex items-center justify-center gap-6 md:justify-start">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Was this page helpful?</p>
      <div className="group grid h-8 grid-cols-[1fr,1px,1fr] overflow-hidden rounded-full border border-zinc-900/10 dark:border-white/10">
        <FeedbackButton data-response="yes">Yes</FeedbackButton>
        <div className="bg-zinc-900/10 dark:bg-white/10" />
        <FeedbackButton data-response="no">No</FeedbackButton>
      </div>
    </form>
  );
});

FeedbackForm.displayName = "FeedbackForm";

const FeedbackThanks = forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>((_props, ref): React.JSX.Element => {
  return (
    <div ref={ref} className="absolute inset-0 flex justify-center md:justify-start">
      <div className="flex items-center gap-3 rounded-full bg-teal-50/50 py-1 pl-1.5 pr-3 text-sm text-teal-900 ring-1 ring-inset ring-teal-500/20 dark:bg-teal-500/5 dark:text-teal-200 dark:ring-teal-500/30">
        <CheckIcon className="h-5 w-5 flex-none fill-teal-500 stroke-white dark:fill-teal-200/20 dark:stroke-teal-200" />
        Thanks for your feedback!
      </div>
    </div>
  );
});

FeedbackThanks.displayName = "FeedbackThanks";

export function Feedback(): React.JSX.Element {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    // event.nativeEvent.submitter.dataset.response
    // => "yes" or "no"

    setSubmitted(true);
  };

  return (
    <div className="relative h-8">
      <Transition
        show={!submitted}
        as={Fragment}
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        leave="pointer-events-none duration-300">
        <FeedbackForm onSubmit={onSubmit} />
      </Transition>
      <Transition
        show={submitted}
        as={Fragment}
        enterFrom="opacity-0"
        enterTo="opacity-100"
        enter="delay-150 duration-300">
        <FeedbackThanks />
      </Transition>
    </div>
  );
}
