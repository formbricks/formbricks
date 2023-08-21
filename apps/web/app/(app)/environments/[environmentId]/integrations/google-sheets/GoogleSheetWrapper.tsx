"use client"

import Home from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Home'
import {useState} from 'react'
import Connect from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Connect'
import AddIntegrationModal from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/AddIntegrationModal'

export default function GoogleSheetWrapper({environmentId,surveys,Spreadsheet,integrations}) {

    const [showSurveySelect, setShowSurveySelect] = useState(false)
    const[selectedSurvey, setSelectedSurvey] = useState()
    const [configCompleted, setConfigCompleted] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [openAddIntegrationModal, setOpenAddIntegrationModal] = useState(false)

    return (
        <>
         <AddIntegrationModal environmentId={environmentId} surveys={surveys} open={openAddIntegrationModal} setOpen={setOpenAddIntegrationModal} spreadsheets={Spreadsheet} integrations={integrations}/>
         {!isConnected && <Connect environmentId={environmentId} setIsConnected={setIsConnected}/>}
         {isConnected && <Home environmentId={environmentId} setShowSurveySelect={setShowSurveySelect} integrations={integrations} setOpenAddIntegrationModal={setOpenAddIntegrationModal}/>}
        </>
    )
   
}

