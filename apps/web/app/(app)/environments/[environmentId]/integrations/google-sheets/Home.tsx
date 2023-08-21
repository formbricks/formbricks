"use client"

import Image from "next/image";
import GoogleSheetsLogo from "@/images/google-sheets-small.png";
import FormbricksGoogleSheet from "@/images/formbricks-googlesheet.png"
import { Button } from "@formbricks/ui";
import { authorization } from "@formbricks/lib/client/google"
import { TrashIcon } from "@heroicons/react/24/outline";
import { upsertIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions";
import { useState } from "react";
import DeleteDialog from "@/components/shared/DeleteDialog";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";


export default function Home({ environmentId, setShowSurveySelect, integrations }) {

    const googleSheetIntegrations = integrations.find((integration) => { return integration.type === "googleSheets" })
    const [isConnecting, setIsConnecting] = useState(false)
    const [isDeleteIntegrationModalOpen, setIsDeleteIntegrationModalOpen] = useState(false)
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
    const [integrationArray, setIntegrationArray] = useState(googleSheetIntegrations.config.data)
    

    const handleGoogleLogin = async () => {
        setIsConnecting(true)
        authorization(environmentId).then((res) => {
            if (res.ok) {
                setShowSurveySelect(true)
                setIsConnecting(false)
            }
        })
    }
    const handleDeleteIntegration = () => {
        if (deleteIndex !== null) {
            integrationArray.splice(deleteIndex, 1);
            upsertIntegrationAction(environmentId, {
                type: "googleSheets",
                environment: environmentId,
                config: {
                    data: integrationArray
                }
            })
            setIntegrationArray(integrationArray)
            setIsDeleteIntegrationModalOpen(false)
        }
    }

    return (
        <div className="flex flex-col justify-center items-center rounded-lg bg-white p-6 shadow mt-6">
            <div className="flex items-center ">
                <Image src={GoogleSheetsLogo} className="h-8 w-6 mr-4" alt="Google sheets Logo" />
                <h1 className="my-2 text-3xl font-bold text-slate-800">Google Sheets Intergation</h1>
            </div>
            <div className="flex flex-col items-center justify-center w-3/4 mt-4">

                <p className="">Elevate your survey experience with FormBricks' cutting-edge integration with Google Sheets. We've revolutionized the way you manage and analyze survey data, making it easier than ever to transform responses into actionable insights.

                    Instant Data Flow: No more manual data entry. With FormBricks' Google Sheets integration, survey responses flow effortlessly from FormBricks to your Google Sheet in real-time. Say goodbye to tedious tasks and hello to accuracy and efficiency.
                </p>

                <div className="rounded-lg border border-slate-200 w-full mt-6">
                    <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                        <div className="col-span-3 pl-6 ">Spreadsheet</div>
                        <div className="col-span-2 text-center hidden sm:block">Survey</div>
                        <div className="col-span-2 text-center hidden sm:block">Actions</div>
                    </div>
                    {integrationArray?.length === 0 &&  
                    <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400 ">
                    You dont have any active google sheet integrations
                  </div>}
                    {integrations?.length > 0 && integrationArray.map((data, index) => {
                        return <div className="m-2 grid h-16  grid-cols-7 content-center rounded-lg hover:bg-slate-100">
                            <div className="col-span-3 pl-6 ">{data.spreadsheetName}</div>
                            <div className="col-span-2 text-center hidden sm:block">{data.surveyName}</div>
                            <div className="col-span-2 text-center">
                                <button onClick={() => {
                                    setDeleteIndex(index)
                                    setIsDeleteIntegrationModalOpen(true)
                                }}>
                                    <TrashIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                                </button>
                            </div>
                        </div>
                    })}
                </div>
                <Image className="w-1/4" src={FormbricksGoogleSheet} alt="Formbricks google sheet Integration" />
                <Button variant="primary" loading={isConnecting} onClick={handleGoogleLogin}>Connect your google account</Button>
            </div>
            <DeleteDialog
                open={isDeleteIntegrationModalOpen}
                setOpen={setIsDeleteIntegrationModalOpen}
                deleteWhat="Integration"
                onDelete={handleDeleteIntegration}
            />
        </div>
    )
}
