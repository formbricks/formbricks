import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type ExportableQuestion, type ExportableSection, type ExportableSurvey } from "./types";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const COLORS = {
  primary: "0EA5E9",
  accent: "8B5CF6",
  dark: "0F172A",
  muted: "64748B",
  light: "F1F5F9",
  border: "E2E8F0",
  white: "FFFFFF",
  required: "DC2626",
};

function metaCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            size: 20,
            color: bold ? COLORS.dark : COLORS.muted,
            font: "Calibri",
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    width: { size: bold ? 2400 : 6600, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: COLORS.white, fill: COLORS.white },
  });
}

function buildQuestionContent(q: ExportableQuestion): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Question heading with number, type, and required badge
  const headingRuns: TextRun[] = [
    new TextRun({
      text: `Q${q.index}  `,
      bold: true,
      size: 24,
      color: COLORS.primary,
      font: "Calibri",
    }),
    new TextRun({
      text: q.headline,
      bold: true,
      size: 24,
      color: COLORS.dark,
      font: "Calibri",
    }),
  ];

  paragraphs.push(
    new Paragraph({
      children: headingRuns,
      spacing: { before: 200, after: 60 },
    })
  );

  // Type and required on same line
  const metaRuns: TextRun[] = [
    new TextRun({ text: q.type, size: 18, color: COLORS.accent, font: "Calibri", bold: true }),
  ];
  if (q.required) {
    metaRuns.push(new TextRun({ text: "  |  ", size: 18, color: COLORS.border, font: "Calibri" }));
    metaRuns.push(
      new TextRun({ text: "REQUIRED", size: 18, color: COLORS.required, bold: true, font: "Calibri" })
    );
  }
  paragraphs.push(new Paragraph({ children: metaRuns, spacing: { after: 60 } }));

  // Subheader
  if (q.subheader) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: q.subheader, size: 20, color: COLORS.muted, italics: true, font: "Calibri" }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  // Details as a table
  if (q.details.length > 0) {
    const detailRows: TableRow[] = q.details.map((d) => {
      const valueText = d.items ? d.items.map((item, i) => `${i + 1}. ${item}`).join("\n") : d.value;
      return new TableRow({
        children: [metaCell(d.label, true), metaCell(valueText)],
      });
    });

    paragraphs.push(new Paragraph({ spacing: { before: 40 }, children: [] }));

    // We push the table separately — collected below
    (paragraphs as (Paragraph | Table)[]).push(
      new Table({
        rows: detailRows,
        width: { size: 9000, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
      })
    );
  }

  // Logic rules
  if (q.logic && q.logic.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Skip Logic:", size: 18, bold: true, color: COLORS.muted, font: "Calibri" }),
        ],
        spacing: { before: 100, after: 40 },
      })
    );
    for (const rule of q.logic) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `  ${rule.summary}`, size: 18, color: COLORS.muted, font: "Courier New" }),
          ],
          spacing: { after: 20 },
        })
      );
    }
  }

  // Divider space
  paragraphs.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  return paragraphs;
}

function buildSectionContent(section: ExportableSection): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  content.push(
    new Paragraph({
      text: section.name,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border, space: 8 },
      },
    })
  );

  if (section.buttonLabel) {
    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Next Button: ", bold: true, size: 20, color: COLORS.muted, font: "Calibri" }),
          new TextRun({ text: section.buttonLabel, size: 20, color: COLORS.dark, font: "Calibri" }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  if (section.logic && section.logic.length > 0) {
    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Block Logic:", size: 18, bold: true, color: COLORS.muted, font: "Calibri" }),
        ],
        spacing: { before: 60, after: 40 },
      })
    );
    for (const rule of section.logic) {
      content.push(
        new Paragraph({
          children: [
            new TextRun({ text: `  ${rule.summary}`, size: 18, color: COLORS.muted, font: "Courier New" }),
          ],
          spacing: { after: 20 },
        })
      );
    }
  }

  for (const q of section.questions) {
    content.push(...buildQuestionContent(q));
  }

  return content;
}

export async function generateSurveyDocx(data: ExportableSurvey): Promise<Blob> {
  const totalQuestions = data.sections.reduce((sum, s) => sum + s.questions.length, 0);

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.name, bold: true, size: 40, color: COLORS.dark, font: "Calibri" })],
      spacing: { after: 120 },
    })
  );

  // Meta line
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Created: ${formatDate(data.createdAt)}  |  Status: ${data.status.toUpperCase()}  |  Type: ${data.type}  |  Questions: ${totalQuestions}`,
          size: 20,
          color: COLORS.muted,
          font: "Calibri",
        }),
      ],
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.primary, space: 12 },
      },
    })
  );

  // Welcome card
  if (data.welcomeCard) {
    children.push(
      new Paragraph({
        text: "Welcome Screen",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      })
    );
    if (data.welcomeCard.headline) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: data.welcomeCard.headline,
              bold: true,
              size: 24,
              color: COLORS.dark,
              font: "Calibri",
            }),
          ],
          spacing: { after: 40 },
        })
      );
    }
    if (data.welcomeCard.subheader) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: data.welcomeCard.subheader, size: 20, color: COLORS.muted, font: "Calibri" }),
          ],
          spacing: { after: 40 },
        })
      );
    }
    if (data.welcomeCard.buttonLabel) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Button: ", bold: true, size: 20, color: COLORS.muted, font: "Calibri" }),
            new TextRun({
              text: data.welcomeCard.buttonLabel,
              size: 20,
              color: COLORS.dark,
              font: "Calibri",
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  // Sections
  for (const section of data.sections) {
    children.push(...buildSectionContent(section));
  }

  // Endings
  if (data.endings.length > 0) {
    children.push(
      new Paragraph({
        text: "Endings",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border, space: 8 },
        },
      })
    );
    for (const ending of data.endings) {
      if (ending.type === "endScreen") {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "End Screen",
                bold: true,
                size: 20,
                color: COLORS.accent,
                font: "Calibri",
              }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
        if (ending.headline) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: ending.headline, bold: true, size: 22, font: "Calibri" })],
              spacing: { after: 20 },
            })
          );
        }
        if (ending.subheader) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: ending.subheader, size: 20, color: COLORS.muted, font: "Calibri" }),
              ],
              spacing: { after: 20 },
            })
          );
        }
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Redirect", bold: true, size: 20, color: COLORS.accent, font: "Calibri" }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
        if (ending.redirectUrl) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `URL: ${ending.redirectUrl}`,
                  size: 20,
                  color: COLORS.muted,
                  font: "Calibri",
                }),
              ],
              spacing: { after: 20 },
            })
          );
        }
      }
    }
  }

  // Hidden fields
  if (data.hiddenFields.length > 0) {
    children.push(
      new Paragraph({
        text: "Hidden Fields",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 80 },
      })
    );
    for (const field of data.hiddenFields) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `  ${field}`, size: 20, color: COLORS.dark, font: "Calibri" })],
          spacing: { after: 20 },
          bullet: { level: 0 },
        })
      );
    }
  }

  // Variables
  if (data.variables.length > 0) {
    children.push(
      new Paragraph({
        text: "Variables",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 80 },
      })
    );
    for (const v of data.variables) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: v.name, bold: true, size: 20, font: "Calibri" }),
            new TextRun({
              text: ` (${v.type}, default: ${v.value})`,
              size: 20,
              color: COLORS.muted,
              font: "Calibri",
            }),
          ],
          spacing: { after: 20 },
          bullet: { level: 0 },
        })
      );
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported from Formbricks on ${formatDate(new Date())}`,
          size: 18,
          color: COLORS.muted,
          font: "Calibri",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border, space: 12 },
      },
    })
  );

  const doc = new Document({
    styles: {
      default: {
        heading2: {
          run: { size: 28, bold: true, color: COLORS.dark, font: "Calibri" },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
