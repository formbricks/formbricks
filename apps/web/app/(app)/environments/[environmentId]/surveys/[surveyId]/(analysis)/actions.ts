'use server'
 import { revalidatePath } from 'next/cache'
 
export default async function revalidateSurveyIdPath(environmentId:string,surveyId:string) {
  revalidatePath(`/environments/${environmentId}/surveys/${surveyId}`)
}