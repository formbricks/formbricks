"use client";

import React, { useState } from "react";
import { EnvelopeIcon } from "@heroicons/react/24/solid";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Toaster, toast } from "react-hot-toast";
import { sendLinkSurveyEmailAction } from "@/app/s/[surveyId]/actions";
import { TSurvey } from "@formbricks/types/surveys";

export default function VerifyEmail({
  survey,
  isErrorComponent,
}: {
  survey: TSurvey;
  isErrorComponent?: boolean;
}) {
  const [showPreviewQuestions, setShowPreviewQuestions] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateEmail = (inputEmail) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail);

  const submitEmail = async (email) => {
    setIsLoading(true);
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email");
      setIsLoading(false);
      return;
    }
    const data = {
      surveyId: survey.id,
      email: email,
      surveyData: survey.verifyEmail,
    };
    try {
      await sendLinkSurveyEmailAction(data);
      setEmailSent(true);
    } catch (error) {
      toast.error(error.message);
    }
    setIsLoading(false);
  };

  const handlePreviewClick = () => {
    setShowPreviewQuestions(!showPreviewQuestions);
  };

  const handleGoBackClick = () => {
    setShowPreviewQuestions(false);
    setEmailSent(false);
  };

  if (isErrorComponent) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50">
        <span className="h-24 w-24 rounded-full bg-slate-300 p-6 text-5xl">🤔</span>
        <p className="mt-8 text-4xl font-bold">This looks fishy.</p>
        <p className="mt-4 cursor-pointer text-sm text-slate-400" onClick={handleGoBackClick}>
          Please try again with the original link
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50">
      <Toaster />
      {!emailSent && !showPreviewQuestions && (
        <div className="flex flex-col items-center justify-center">
          <EnvelopeIcon className="h-24 w-24 rounded-full bg-slate-300 p-6 text-white" />
          <p className="mt-8 text-4xl font-bold">Verify your email to respond.</p>
          <p className="mt-2 text-slate-400">To respond to this survey please verify your email.</p>
          <div className="mt-6 flex w-full space-x-2">
            <Input
              type="string"
              className="h-full"
              placeholder="user@gmail.com"
              value={email || ""}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button variant="darkCTA" onClick={() => submitEmail(email)} loading={isLoading}>
              Verify
            </Button>
          </div>
          <p className="mt-6 cursor-pointer text-sm text-slate-400" onClick={handlePreviewClick}>
            Just curious? Preview survey questions.
          </p>
        </div>
      )}
      {!emailSent && showPreviewQuestions && (
        <div className="flex flex-col items-center justify-center">
          <p className="text-4xl font-bold">Question Preview</p>
          <div className="mt-4 flex w-full flex-col justify-center rounded-lg border border-slate-200 p-8">
            {survey.questions.map((question, index) => (
              <p key={index} className="my-1">{`${index + 1}. ${question.headline}`}</p>
            ))}
          </div>
          <p className="mt-6 cursor-pointer text-sm text-slate-400" onClick={handlePreviewClick}>
            Want to respond? Verify email.
          </p>
        </div>
      )}
      {emailSent && (
        <div className="flex flex-col items-center justify-center">
          <h1 className="mt-8 text-4xl font-bold">Survey sent successfully</h1>
          <p className="mt-4 text-center text-slate-400">
            We sent an email to <span className="font-semibold italic">{email}</span>. Please click the link
            in the email to take your survey.
          </p>
          <p className="mt-6 cursor-pointer text-sm text-slate-400" onClick={handleGoBackClick}>
            Go Back
          </p>
        </div>
      )}
    </div>
  );
}
