import { type ExportableQuestion, type ExportableSection, type ExportableSurvey } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfTableCell = any;

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const COLORS = {
  primary: "#0EA5E9",
  accent: "#8B5CF6",
  dark: "#0F172A",
  muted: "#64748B",
  light: "#F8FAFC",
  border: "#E2E8F0",
  required: "#DC2626",
  bgCard: "#FFFFFF",
};

function buildQuestionContent(q: ExportableQuestion): Content[] {
  const content: Content[] = [];

  // Header row: number + headline + badges
  const badges: string[] = [q.type];
  if (q.required) badges.push("REQUIRED");

  content.push({
    columns: [
      {
        width: 36,
        text: `Q${q.index}`,
        style: "questionNumber",
      },
      {
        width: "*",
        stack: [
          { text: q.headline, style: "questionHeadline" },
          {
            text: badges.join("  |  "),
            style: q.required ? "badgeRequired" : "badgeType",
          },
          ...(q.subheader ? [{ text: q.subheader, style: "questionSubheader" as const } as Content] : []),
        ],
      },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 4] as [number, number, number, number],
  });

  // Details table
  if (q.details.length > 0) {
    const tableBody: PdfTableCell[][] = q.details.map((d) => {
      const valueContent: Content = d.items
        ? {
            ul: d.items.map((item) => ({ text: item, fontSize: 9, color: COLORS.dark })),
            markerColor: COLORS.muted,
          }
        : { text: d.value, fontSize: 9, color: COLORS.dark };

      return [{ text: d.label, fontSize: 9, bold: true, color: COLORS.muted }, valueContent];
    });

    content.push({
      margin: [36, 4, 0, 0] as [number, number, number, number],
      table: {
        widths: [100, "*"],
        body: tableBody,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 4,
        paddingRight: () => 4,
      },
    });
  }

  // Logic rules
  if (q.logic && q.logic.length > 0) {
    content.push({
      margin: [36, 6, 0, 0] as [number, number, number, number],
      stack: [
        { text: "Skip Logic", style: "logicLabel" },
        ...q.logic.map(
          (rule) =>
            ({
              text: rule.summary,
              fontSize: 8,
              color: COLORS.muted,
              font: "Roboto",
              margin: [0, 2, 0, 0] as [number, number, number, number],
            }) as Content
        ),
      ],
      fillColor: COLORS.light,
    });
  }

  // Divider line
  content.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 480,
        y2: 0,
        lineWidth: 0.5,
        lineColor: COLORS.border,
      },
    ],
    margin: [0, 10, 0, 6] as [number, number, number, number],
  });

  return content;
}

function buildSectionContent(section: ExportableSection): Content[] {
  const content: Content[] = [];

  content.push({ text: section.name, style: "sectionTitle" });

  if (section.buttonLabel) {
    content.push({
      text: [
        { text: "Next Button: ", bold: true, color: COLORS.muted },
        { text: section.buttonLabel, color: COLORS.dark },
      ],
      fontSize: 9,
      margin: [0, 0, 0, 8] as [number, number, number, number],
    });
  }

  if (section.logic && section.logic.length > 0) {
    content.push({
      stack: [
        { text: "Block Logic", style: "logicLabel" },
        ...section.logic.map(
          (rule) =>
            ({
              text: rule.summary,
              fontSize: 8,
              color: COLORS.muted,
              font: "Roboto",
              margin: [0, 2, 0, 0] as [number, number, number, number],
            }) as Content
        ),
      ],
      fillColor: COLORS.light,
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  for (const q of section.questions) {
    content.push(...buildQuestionContent(q));
  }

  return content;
}

export async function generateSurveyPdf(data: ExportableSurvey): Promise<Blob> {
  // Dynamic import to keep pdfmake out of initial bundle
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMake = pdfMakeModule.default || pdfMakeModule;

  // Set up virtual file system for fonts
  // pdfmake exports fonts in different ways depending on the bundler
  const fontsModule = pdfFontsModule as Record<string, unknown>;
  const vfsSource =
    (fontsModule.pdfMake as { vfs?: Record<string, string> } | undefined)?.vfs ||
    (fontsModule.default as { pdfMake?: { vfs: Record<string, string> } } | undefined)?.pdfMake?.vfs;
  if (vfsSource) {
    pdfMake.vfs = vfsSource;
  }

  const totalQuestions = data.sections.reduce((sum, s) => sum + s.questions.length, 0);

  const content: Content[] = [];

  // Title block
  content.push({ text: data.name, style: "title" });
  content.push({
    text: `Created: ${formatDate(data.createdAt)}  |  Status: ${data.status.toUpperCase()}  |  Type: ${data.type}  |  Questions: ${totalQuestions}`,
    style: "metaLine",
  });
  content.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 480,
        y2: 0,
        lineWidth: 2,
        lineColor: COLORS.primary,
      },
    ],
    margin: [0, 8, 0, 16] as [number, number, number, number],
  });

  // Welcome card
  if (data.welcomeCard) {
    content.push({ text: "Welcome Screen", style: "sectionTitle" });
    if (data.welcomeCard.headline) {
      content.push({
        text: data.welcomeCard.headline,
        bold: true,
        fontSize: 12,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      });
    }
    if (data.welcomeCard.subheader) {
      content.push({
        text: data.welcomeCard.subheader,
        fontSize: 10,
        color: COLORS.muted,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      });
    }
    if (data.welcomeCard.buttonLabel) {
      content.push({
        text: [{ text: "Button: ", bold: true }, data.welcomeCard.buttonLabel],
        fontSize: 10,
        margin: [0, 0, 0, 16] as [number, number, number, number],
      });
    }
  }

  // Sections
  for (const section of data.sections) {
    content.push(...buildSectionContent(section));
  }

  // Endings
  if (data.endings.length > 0) {
    content.push({ text: "Endings", style: "sectionTitle" });
    for (const ending of data.endings) {
      if (ending.type === "endScreen") {
        content.push({
          text: "End Screen",
          fontSize: 10,
          bold: true,
          color: COLORS.accent,
          margin: [0, 4, 0, 2] as [number, number, number, number],
        });
        if (ending.headline)
          content.push({
            text: ending.headline,
            fontSize: 11,
            bold: true,
            margin: [0, 0, 0, 2] as [number, number, number, number],
          });
        if (ending.subheader)
          content.push({
            text: ending.subheader,
            fontSize: 9,
            color: COLORS.muted,
            margin: [0, 0, 0, 2] as [number, number, number, number],
          });
      } else {
        content.push({
          text: "Redirect",
          fontSize: 10,
          bold: true,
          color: COLORS.accent,
          margin: [0, 4, 0, 2] as [number, number, number, number],
        });
        if (ending.redirectUrl)
          content.push({
            text: `URL: ${ending.redirectUrl}`,
            fontSize: 9,
            color: COLORS.muted,
            margin: [0, 0, 0, 2] as [number, number, number, number],
          });
      }
    }
  }

  // Hidden fields
  if (data.hiddenFields.length > 0) {
    content.push({ text: "Hidden Fields", style: "sectionTitle" });
    content.push({
      ul: data.hiddenFields.map((f) => ({ text: f, fontSize: 9 })),
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  // Variables
  if (data.variables.length > 0) {
    content.push({ text: "Variables", style: "sectionTitle" });
    content.push({
      ul: data.variables.map((v) => ({
        text: [
          { text: v.name, bold: true },
          { text: ` (${v.type}, default: ${v.value})`, color: COLORS.muted },
        ],
        fontSize: 9,
      })),
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  const docDefinition = {
    pageSize: "LETTER",
    pageMargins: [50, 50, 50, 60],
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `Exported from Formbricks on ${formatDate(new Date())}`,
          fontSize: 8,
          color: COLORS.muted,
          italics: true,
          margin: [50, 0, 0, 0] as [number, number, number, number],
        },
        {
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          color: COLORS.muted,
          alignment: "right" as const,
          margin: [0, 0, 50, 0] as [number, number, number, number],
        },
      ],
    }),
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: COLORS.dark,
        margin: [0, 0, 0, 6],
      },
      metaLine: {
        fontSize: 9,
        color: COLORS.muted,
        margin: [0, 0, 0, 4],
      },
      sectionTitle: {
        fontSize: 14,
        bold: true,
        color: COLORS.dark,
        margin: [0, 16, 0, 8],
      },
      questionNumber: {
        fontSize: 11,
        bold: true,
        color: COLORS.primary,
      },
      questionHeadline: {
        fontSize: 12,
        bold: true,
        color: COLORS.dark,
        margin: [0, 0, 0, 2],
      },
      questionSubheader: {
        fontSize: 9,
        color: COLORS.muted,
        italics: true,
        margin: [0, 2, 0, 4],
      },
      badgeType: {
        fontSize: 8,
        bold: true,
        color: COLORS.accent,
        margin: [0, 1, 0, 4],
      },
      badgeRequired: {
        fontSize: 8,
        bold: true,
        color: COLORS.required,
        margin: [0, 1, 0, 4],
      },
      logicLabel: {
        fontSize: 8,
        bold: true,
        color: COLORS.muted,
        margin: [0, 0, 0, 2],
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };

  return new Promise((resolve) => {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBlob((blob: Blob) => {
      resolve(blob);
    });
  });
}
