import type { NextApiRequest, NextApiResponse } from "next";
import { authorize } from "@/pages/api/v1/environments/[environmentId]/google";
const { google } = require('googleapis'); 



async function getSpreadsheets(auth) {

    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app
    const service = google.drive({ version: 'v3', auth });
    try {
        const res = await service.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'  AND trashed=false",
            fields: 'nextPageToken, files(id, name)' 
        });
        return res.data.files;
    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}

export async function writeData(spreadsheetId,values) {
  console.log(values)
  const auth = await authorize();
    console.log("writing data")
    const sheets = google.sheets({ version: 'v4', auth });
    const resource = {
      values,
    };
    sheets.spreadsheets.values.append(
        {
            spreadsheetId: spreadsheetId, // Your spreadsheet ID
            range: 'A1',
            valueInputOption: 'RAW',
            resource: resource,
          },
      (err, result) => {
        if (err) {
          // Handle error
          console.log(err);
        } else {
          console.log(
            '%d cells updated on range: %s',
            result.data.updates.updatedCells,
            result.data.updates.updatedRange
          );
        }
      }
    );
  }


export default async function handle(req: NextApiRequest, res: NextApiResponse) {

    // GET
    if (req.method === "GET") {
       const response = await authorize().then(getSpreadsheets)
       res.send(response)
    }
    // else if (req.method === "POST"){
    //     const response = await authorize().then(writeData)
    //     res.send(response)
    // }
    else {
      throw new Error(`errr`);
    }
  }
  