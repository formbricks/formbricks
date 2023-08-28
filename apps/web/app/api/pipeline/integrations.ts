import { writeData } from "@formbricks/lib/services/googleSheet";
export async function handleIntegrations(integrations:any,data:any){
    integrations.forEach((integration) =>{
        if(integration.type==='googleSheets'){
          if(integration.config.data.length >0){
            integration.config.data.forEach(element => {
              if(element.surveyId===data.surveyId){
                const values = extractResponses(data, element.questionIds)
                console.log(values)
                console.log(element.spreadsheetId)
                writeData(integration.config.key,element.spreadsheetId,[values])
              }
            });
          } 
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
  