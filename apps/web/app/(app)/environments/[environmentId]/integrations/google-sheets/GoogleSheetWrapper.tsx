"use client"

import Home from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Home'
import SurveySelect from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/SurveySelect'
import SpreadsheetSelect from "./SpreadsheetSelect"
import {useState,useEffect} from 'react'

export default function GoogleSheetWrapper({environmentId,surveys,Spreadsheet}) {

    useEffect(() => {
      console.log(selectedSurvey)
    }, [])
    

    const [showSurveySelect, setShowSurveySelect] = useState(false)
    const[selectedSurvey, setSelectedSurvey] = useState()

    if(selectedSurvey){
        return <SpreadsheetSelect environmentId={environmentId} spreadsheet={Spreadsheet} selectedSurvey={selectedSurvey}/>
    }

    if(!showSurveySelect){
        return <Home environmentId={environmentId} setShowSurveySelect={setShowSurveySelect}/>
    }
    else {
        return < SurveySelect environmentId={environmentId}  surveys={surveys} setSelectedSurvey={setSelectedSurvey}/>
    }
  
}

