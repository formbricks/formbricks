import { prisma } from "@formbricks/database";
import * as fs from "fs";
import { parseAsync } from "json2csv";
import type { NextApiRequest, NextApiResponse } from "next";
import { getRawSubmission, getSubmission } from "../../../../lib/submissionSessions";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  throw new Error(`This route is private`);

  if (req.method === "GET") {
    const forms = await prisma.form.findMany({
      where: {
        owner: { email: req.query.userMail.toString() },
      },
      include: {
        submissionSessions: {
          include: {
            events: true,
          },
        },
      },
    });
    for (const form of forms) {
      const rawSubmissios = form.submissionSessions.map((s) => getRawSubmission(s));
      const rawCsv = await createCsvFromRawSubmission(rawSubmissios);
      fs.writeFile(`exports/${form.name}-raw.csv`, rawCsv, function (err) {
        if (err) throw err;
      });
      const submissions = form.submissionSessions.map((s) => getSubmission(s, form.schema));
      // build data fields for csv/excel file

      const csv = await createCsvFromSubmission(submissions);
      try {
        fs.writeFile(`exports/${form.name}.csv`, csv, function (err) {
          if (err) throw err;
        });
        // download
        var blob = new Blob([csv], { type: "text/csv" });
      } catch (e) {
        res.status(500).send(e);
      }
    }
    res.send("success");
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}

async function createCsvFromSubmission(submissions: any[]) {
  const data = [];
  for (const submission of submissions) {
    const dataEntry = { createdAt: submission.createdAt };
    for (const page of submission.pages) {
      if (page.elements) {
        for (const element of page.elements) {
          if (element.type !== "submit") {
            dataEntry[element.label] = element.value;
          }
        }
      }
    }
    data.push(dataEntry);
  }

  // get fields
  const fields: any = [
    {
      label: "Timestamp",
      value: "createdAt",
    },
  ];

  for (const page of submissions[0].pages) {
    for (const element of page.elements) {
      if (element.type !== "submit") {
        fields.push({
          label: element.label,
          value: element.label,
        });
      }
    }
  }
  const opts: any = { fields };

  try {
    const csv = await parseAsync(data, opts);
    return csv;
  } catch (e) {
    throw Error(e);
  }
}

async function createCsvFromRawSubmission(submissions: any[]) {
  const data = [];
  // get fields
  const fields: any = [
    {
      label: "Timestamp",
      value: "createdAt",
    },
  ];
  for (const submission of submissions) {
    const dataEntry = { createdAt: submission.createdAt };
    for (const [key, value] of Object.entries(submission.data)) {
      dataEntry[key] = value;
      if (!fields.find((f) => f.label === key)) {
        fields.push({
          label: key,
          value: key,
        });
      }
    }
    data.push(dataEntry);
  }

  const opts: any = { fields };

  try {
    const csv = await parseAsync(data, opts);
    return csv;
  } catch (e) {
    throw Error(e);
  }
}
