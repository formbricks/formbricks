"use client"

import Home from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/Home'
import SurveySelect from '@/app/(app)/environments/[environmentId]/integrations/google-sheets/SurveySelect'
import {useState} from 'react'

export default function GoogleSheetWrapper({environmentId,surveys}) {

    const [showSurveySelect, setShowSurveySelect] = useState(false)

    if(!showSurveySelect){
        return <Home environmentId={environmentId} setShowSurveySelect={setShowSurveySelect}/>
    }
    else {
        return < SurveySelect environmentId={environmentId}  surveys={surveys}/>
    }
  
}

