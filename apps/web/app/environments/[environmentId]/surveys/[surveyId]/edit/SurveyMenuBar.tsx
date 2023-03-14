"use client";

import Button from "@/components/ui/Button";

export default function SurveyMenuBar({}) {
  return (
    <div className="border-b border-gray-200 bg-white py-3 px-5 sm:flex sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold leading-6 text-gray-900">My new Survey</h3>
      <div className="mt-3 flex sm:mt-0 sm:ml-4">
        <Button variant="secondary" className="mr-3">
          Save changes
        </Button>
        <Button variant="highlight">Publish Survey</Button>
      </div>
    </div>
  );
}
