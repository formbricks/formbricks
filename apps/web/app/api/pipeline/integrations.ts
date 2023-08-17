import { writeData } from "@/pages/api/v1/environments/[environmentId]/google/spreadsheets"
export async function handleIntegrations(integrations:any,data:any){
    integrations.forEach((integration) =>{
        if(integration.type==='googleSheets' && integration.config.surveyId === data.surveyId){
            const values = extractResponses(data, integration.config.questionIds)
            writeData(integration.config.spreadsheetId,[values])
        }
    })

}
function extractResponses(data, questionIds) {
    const responses = <string[]>([]);
  
    for (const questionId of questionIds) {
      const responseValue = data.response.data[questionId];
      if (responseValue !== undefined) {
        responses.push(responseValue);
      }
    }
  
    return responses;
  }
  