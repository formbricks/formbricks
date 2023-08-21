"use client"

import { Confetti } from "@formbricks/ui";
import { CheckIcon } from "@heroicons/react/20/solid";
import { Button } from "@formbricks/ui";
import Link from "next/link";

export default function SuccessMessage({ selectedSurvey }) {
    return (
        <>
            <div className="h-[75vh] w-full flex items-center justify-center">
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-6 shadow w-3/4">
                    <div
                        className="h-12 w-12 rounded-full bg-white p-2">
                        < CheckIcon />
                    </div>
                    <p className="text-xl font-bold text-slate-800 my-6">Google sheet Integration configured successfully</p>
                    <Link href={`${window.location.protocol}//${window.location.host}/s/${selectedSurvey.id}`} target="_blank">
                        <Button variant="primary">Test it</Button>
                    </Link>

                </div>
            </div>
            <Confetti />
        </>
    );
}
