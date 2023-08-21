"use client"

import Home from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Home'
import SurveySelect from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/SurveySelect'
import SpreadsheetSelect from "./SpreadsheetSelect"
import {useState} from 'react'
import SuccessMessage from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/SuccessMessage'

export default function GoogleSheetWrapper({environmentId,surveys,Spreadsheet,integrations}) {

    const [showSurveySelect, setShowSurveySelect] = useState(false)
    const[selectedSurvey, setSelectedSurvey] = useState()
    const [configCompleted, setConfigCompleted] = useState(false)

    if(configCompleted){
        return <SuccessMessage selectedSurvey={selectedSurvey}/>
    }

    if(selectedSurvey){
        return <SpreadsheetSelect environmentId={environmentId} spreadsheet={Spreadsheet} selectedSurvey={selectedSurvey} integrations={integrations} setConfigCompleted={setConfigCompleted}/>
    }

    if(!showSurveySelect){
        return <Home environmentId={environmentId} setShowSurveySelect={setShowSurveySelect} integrations={integrations}/>
    }
    else {
        return < SurveySelect environmentId={environmentId}  surveys={surveys} setSelectedSurvey={setSelectedSurvey}/>
    }
  
}

