import type { NextApiRequest, NextApiResponse } from "next";
import { authorize } from "@/pages/api/v1/environments/[environmentId]/google";

async function getSpreadsheets(auth) {
    const { google } = require('googleapis');

    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app
    const service = google.drive({ version: 'v3', auth });
    try {
        const res = await service.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'nextPageToken, files(id, name)'
        });
        return res.data.files;
    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}


export default async function handle(req: NextApiRequest, res: NextApiResponse) {

    // GET
    if (req.method === "GET") {
       const response = await authorize().then(getSpreadsheets)
       console.log(response)
       res.send(response)
    }
    else {
      throw new Error(`errr`);
    }
  }
  