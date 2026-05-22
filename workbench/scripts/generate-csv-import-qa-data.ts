#!/usr/bin/env -S node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON

/**
 * CSV import QA fixture generator for Formbricks.
 *
 * This script creates realistic CSV files under `.local/generated-csv/` for exercising the
 * Unify CSV import flow. It is intentionally dependency-free and can be run directly with
 * Node 24, so it does not require changes to package.json or the workspace lockfile. This repo
 * package is not declared as `"type": "module"`, so the command below silences Node's specific
 * typeless-package warning while still letting Node detect and run this `.ts` file as ESM.
 *
 * Behavior:
 * - Generates a deterministic set of CSV fixtures by default (`--seed=4267`).
 * - Writes output next to this script in `.local/generated-csv/*.csv`.
 * - Cleans the output directory before writing unless `--no-clean` is passed.
 * - Produces realistic third-party survey exports, a Formbricks/Hub-ready long-format CSV,
 *   multilingual data, mixed data types, JSON/raw metadata, and intentionally invalid CSVs.
 * - Keeps generated files upload-ready: the CSV files do not contain explanatory comments.
 *
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .local/generate-csv-import-qa-data.ts
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .local/generate-csv-import-qa-data.ts --submissions=120 --seed=1234
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .local/generate-csv-import-qa-data.ts --no-clean
 *
 * If this file is executable, the shebang already includes that warning-suppression flag:
 *   ./.local/generate-csv-import-qa-data.ts
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type CsvPrimitive = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvPrimitive>;

interface OutputFile {
  name: string;
  description: string;
  usage: string[];
  content: string;
}

interface Options {
  seed: number;
  submissions: number;
  clean: boolean;
}

interface HubQuestionDefinition {
  field_id: string;
  field_label: string;
  field_type: string;
  value: (language: string) => CsvPrimitive;
}

const DEFAULT_OPTIONS: Options = {
  seed: 4267,
  submissions: 80,
  clean: true,
};

const MAX_HUB_READY_SUBMISSIONS = 90;

const parseOptions = (): Options => {
  const options = { ...DEFAULT_OPTIONS };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--no-clean") {
      options.clean = false;
      continue;
    }

    const [key, value] = arg.split("=");
    if (!value) continue;

    if (key === "--seed") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) options.seed = parsed;
    }

    if (key === "--submissions") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) options.submissions = Math.max(1, Math.min(parsed, 200));
    }
  }

  return options;
};

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

class DataGenerator {
  private random: () => number;

  constructor(seed: number) {
    this.random = createRandom(seed);
  }

  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.random() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  maybe<T>(value: T, probability = 0.1, fallback: T | "" = ""): T | "" {
    return this.chance(probability) ? fallback : value;
  }

  id(prefix: string, index: number): string {
    return `${prefix}_${String(index + 1).padStart(5, "0")}`;
  }

  dateWithinDays(daysBack: number, offsetMinutes = 0): Date {
    const base = Date.UTC(2026, 4, 7, 10, 15, 0);
    const minutesBack = this.int(0, daysBack * 24 * 60) + offsetMinutes;
    return new Date(base - minutesBack * 60_000);
  }

  iso(daysBack: number): string {
    return this.dateWithinDays(daysBack).toISOString();
  }

  localDate(daysBack: number): string {
    return this.dateWithinDays(daysBack).toISOString().slice(0, 10);
  }

  email(firstName: string, lastName: string): string {
    const domain = this.pick(["example.com", "acme.co", "northwind.io", "contoso.test", "globex.com"]);
    return `${slug(firstName)}.${slug(lastName)}@${domain}`;
  }
}

const languages = ["en", "de", "fr", "es", "pt", "ja", "zh", "nl", "it", "sv"] as const;
const plans = ["Free", "Starter", "Growth", "Enterprise", "Trial", "Legacy Pro"] as const;
const roles = [
  "Founder",
  "Product Manager",
  "Customer Success",
  "Engineer",
  "Operations",
  "Marketing",
] as const;
const regions = ["North America", "DACH", "Benelux", "France", "Iberia", "Brazil", "Japan", "India"] as const;
const channels = ["in-app", "email", "web", "mobile SDK", "support chat", "post-purchase"] as const;
const browsers = ["Chrome", "Safari", "Firefox", "Edge", "Samsung Internet"] as const;
const devices = ["desktop", "mobile", "tablet"] as const;
const operatingSystems = ["macOS", "Windows", "iOS", "Android", "Linux"] as const;
const featureAreas = [
  "Dashboard",
  "Integrations",
  "Billing",
  "Survey editor",
  "Reports",
  "User management",
] as const;
const firstNames = [
  "Ava",
  "Mia",
  "Noah",
  "Leo",
  "Sofia",
  "Mateo",
  "Lina",
  "Jonas",
  "Yuki",
  "Camila",
  "Zoë",
  "André",
  "Marta",
  "Nora",
  "Ravi",
  "Mei",
] as const;
const lastNames = [
  "Müller",
  "Silva",
  "Tanaka",
  "Garcia",
  "Smith",
  "Kowalski",
  "Dubois",
  "Rossi",
  "Nakamura",
  "Khan",
  "Martínez",
  "Jensen",
] as const;

const feedbackByLanguage: Record<string, string[]> = {
  en: [
    "Setup was fast, but the billing page still feels confusing.",
    "The dashboard is clear. I would like better filters for enterprise accounts.",
    "Great support experience, especially during onboarding.",
    "I hit a validation error after pasting a long comment with commas, quotes, and line breaks.",
  ],
  de: [
    "Die Einrichtung war einfach, aber die Übersetzungen im Bericht sind uneinheitlich.",
    "Sehr gutes Produkt. Die Ladezeit im Dashboard könnte besser sein.",
    "Bitte zeigt deutlicher, welche Daten beim CSV-Import übersprungen wurden.",
  ],
  fr: [
    "L'import a bien fonctionné, mais certaines colonnes n'étaient pas reconnues.",
    "Très utile pour l'équipe support; il manque seulement des filtres plus rapides.",
  ],
  es: [
    "La encuesta funciona bien, aunque el texto del botón no se traduce siempre.",
    "Necesitamos exportar respuestas por región y por plan.",
  ],
  pt: [
    "A experiência foi boa, mas os campos personalizados ficaram difíceis de mapear.",
    "Gostei do editor de pesquisas; faltam alertas mais claros.",
  ],
  ja: [
    "設定は簡単でしたが、CSVの列名が英語以外だと分かりにくいです。",
    "サポートの対応は速かったです。レポート画面も使いやすいです。",
  ],
  zh: ["整体体验不错，但导入后有些日期格式没有被识别。", "希望能更清楚地显示哪些行被跳过。"],
  nl: ["De import werkte goed, maar de kolomnamen waren soms lastig te koppelen."],
  it: ["Ottima esperienza, però vorrei controlli migliori sui dati duplicati."],
  sv: ["Bra flöde, men datumformaten behöver vara mer förlåtande."],
};

const textValue = (generator: DataGenerator, language: string): string => {
  const pool = feedbackByLanguage[language] ?? feedbackByLanguage.en;
  const value = generator.pick(pool);
  if (!generator.chance(0.12)) return value;

  return `${value}
Follow-up note: customer pasted this from another tool, including "quoted text" and comma-separated tags.`;
};

const csvEscape = (value: CsvPrimitive): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/["\n\r,]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
};

const toCsv = (headers: string[], rows: CsvRow[]): string => {
  const lines = [headers.map((header) => csvEscape(header)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
};

const slug = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

const metadata = (generator: DataGenerator, extra: Record<string, string | number | boolean> = {}): string =>
  JSON.stringify({
    plan: generator.pick(plans),
    region: generator.pick(regions),
    channel: generator.pick(channels),
    device: generator.pick(devices),
    browser: generator.pick(browsers),
    os: generator.pick(operatingSystems),
    feature_area: generator.pick(featureAreas),
    ...extra,
  });

const createHubReadyRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [];
  const questionSet: HubQuestionDefinition[] = [
    {
      field_id: "nps_recommend",
      field_label: "How likely are you to recommend us?",
      field_type: "nps",
      value: (_language) => generator.int(0, 10),
    },
    {
      field_id: "csat_support",
      field_label: "How satisfied are you with support?",
      field_type: "csat",
      value: (_language) => generator.int(1, 5),
    },
    {
      field_id: "ces_setup",
      field_label: "How easy was it to complete setup?",
      field_type: "ces",
      value: (_language) => generator.int(1, 7),
    },
    {
      field_id: "feature_rating",
      field_label: "Feature quality rating",
      field_type: "rating",
      value: (_language) => generator.pick([1, 2, 3, 4, 5, "4.5"]),
    },
    {
      field_id: "main_feedback",
      field_label: "What should we improve?",
      field_type: "text",
      value: (language: string) => textValue(generator, language),
    },
    {
      field_id: "primary_use_case",
      field_label: "Primary use case",
      field_type: "categorical",
      value: (_language) =>
        generator.pick(["Product feedback", "Customer support", "Market research", "Employee pulse"]),
    },
    {
      field_id: "may_contact",
      field_label: "May we contact you?",
      field_type: "boolean",
      value: (_language) => generator.pick(["true", "false", "yes", "no", "1", "0"]),
    },
    {
      field_id: "renewal_date",
      field_label: "Expected renewal date",
      field_type: "date",
      value: (_language) => generator.localDate(120),
    },
  ];

  for (let i = 0; i < submissions; i++) {
    const submissionId = generator.id("sub", i);
    const sourceId = generator.pick([
      "survey_product_q2_2026",
      "survey_onboarding_v4",
      "survey_churn_reasons",
    ]);
    const sourceName = sourceId === "survey_product_q2_2026" ? "Q2 Product Experience" : sourceId;
    const language = generator.pick(languages);
    const userIdentifier = generator.chance(0.08) ? "" : generator.id("user", generator.int(10, 5000));
    const collectedAt = generator.iso(75);
    const groupId = generator.id("response", i);

    for (const question of questionSet) {
      if (generator.chance(0.06)) continue;

      rows.push({
        collected_at: collectedAt,
        submission_id: submissionId,
        source_id: sourceId,
        source_name: sourceName,
        field_id: question.field_id,
        field_label: question.field_label,
        field_type: question.field_type,
        response: question.value(language),
        field_group_id: "",
        field_group_label: "",
        language,
        user_identifier: userIdentifier,
        metadata: metadata(generator, { import_source: "formbricks_like_long", row_group: groupId }),
      });
    }

    const matrixGroupId = `matrix_product_quality_${submissionId}`;
    for (const area of ["Reliability", "Performance", "Ease of use"]) {
      rows.push({
        collected_at: collectedAt,
        submission_id: submissionId,
        source_id: sourceId,
        source_name: sourceName,
        field_id: `matrix_quality_${slug(area)}`,
        field_label: area,
        field_type: "rating",
        response: generator.int(1, 5),
        field_group_id: matrixGroupId,
        field_group_label: "Rate each part of the product experience",
        language,
        user_identifier: userIdentifier,
        metadata: metadata(generator, { import_source: "matrix_question", matrix_row: area }),
      });
    }
  }

  return rows;
};

const createTypeformWideRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [];

  for (let i = 0; i < submissions; i++) {
    const firstName = generator.pick(firstNames);
    const lastName = generator.pick(lastNames);
    const language = generator.pick(languages);
    const submittedAt = generator.iso(60);

    rows.push({
      "Response ID": generator.id("typeform", i),
      "Submitted At": submittedAt,
      "Landed At": new Date(new Date(submittedAt).getTime() - generator.int(30, 900) * 1000).toISOString(),
      "Network ID": generator.id("net", generator.int(100, 999)),
      "What best describes your role?": generator.pick(roles),
      "How likely are you to recommend us?": generator.int(0, 10),
      "What made you choose that score?": textValue(generator, language),
      "Feature satisfaction": generator.pick(["Very satisfied", "Satisfied", "Neutral", "Unsatisfied"]),
      "Which features do you use?": generator.pick([
        "Dashboards; Exports; Alerts",
        "Integrations; Webhooks",
        "Survey editor; Reports",
        "SSO; Audit logs; Permissions",
      ]),
      "May we contact you?": generator.pick(["Yes", "No"]),
      Email: generator.maybe(generator.email(firstName, lastName), 0.15),
      Language: language,
      "Hidden: plan": generator.pick(plans),
      "Hidden: account_id": generator.id("acct", generator.int(1, 1200)),
      "Hidden: signed_up_at": generator.localDate(720),
    });
  }

  return rows;
};

const createSurveyMonkeyRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [];

  for (let i = 0; i < submissions; i++) {
    const language = generator.pick(languages);

    rows.push({
      "Respondent ID": generator.id("sm", i),
      "Collector ID": generator.pick(["Website Collector", "Email Collector", "Mobile Link"]),
      "Start Date": generator.iso(45),
      "End Date": generator.iso(45),
      "IP Address": generator.chance(0.2) ? "" : `192.0.2.${generator.int(1, 254)}`,
      "Custom Data 1": generator.id("workspace", generator.int(1, 99)),
      "Custom Data 2": generator.pick(plans),
      "Q1: Overall, how satisfied are you with our product?": generator.int(1, 5),
      "Q2: Why did you choose that answer?": textValue(generator, language),
      "Q3: Which team uses the product most?": generator.pick([
        "Product",
        "Support",
        "Sales",
        "Marketing",
        "Engineering",
      ]),
      "Q4: Did you contact support?": generator.pick(["Yes", "No", "N/A"]),
      "Q5: Support ticket resolved?": generator.pick(["true", "false", "1", "0", "not applicable"]),
      "Other (please specify)": generator.pick([
        "",
        "Needs SOC2 docs",
        "Asked for German invoices",
        "CSV import",
      ]),
      "Other (please specify).1": generator.pick(["", "Slack", "HubSpot", "Zendesk"]),
      Tags: generator.pick(["promoter,enterprise", "trial,onboarding", "bug,import", "renewal"]),
      Locale: language,
    });
  }

  return rows;
};

const createGoogleFormsRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [];

  for (let i = 0; i < submissions; i++) {
    const firstName = generator.pick(firstNames);
    const lastName = generator.pick(lastNames);
    const language = generator.pick(["es", "de", "fr", "pt", "ja", "zh"]);

    rows.push({
      "Marca temporal": generator.iso(90),
      "Dirección de correo electrónico": generator.email(firstName, lastName),
      "Wie zufrieden bist du mit dem Onboarding?": generator.int(1, 5),
      "¿Qué deberíamos mejorar?": textValue(generator, language),
      "Quelle fonctionnalité utilisez-vous le plus ?": generator.pick(featureAreas),
      "Você autorizou contato de acompanhamento?": generator.pick(["Sim", "Não", "true", "false"]),
      "次回更新日はいつですか？": generator.localDate(365),
      "言語 / Idioma": language,
      Plano: generator.pick(plans),
      "Notas internas": generator.chance(0.18) ? "contains non-English headers and mixed boolean labels" : "",
    });
  }

  return rows;
};

const createQualtricsMatrixRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [
    {
      StartDate: "Start Date",
      EndDate: "End Date",
      Status: "Response Type",
      Progress: "Progress",
      Duration: "Duration (in seconds)",
      Finished: "Finished",
      RecordedDate: "Recorded Date",
      ResponseId: "Response ID",
      RecipientEmail: "Recipient Email",
      ExternalReference: "External Data Reference",
      QID1: "How likely are you to recommend us?",
      QID2_1: "Please rate - Reliability",
      QID2_2: "Please rate - Performance",
      QID2_3: "Please rate - Ease of use",
      QID3_TEXT: "Tell us more",
      QID4: "May we follow up?",
      userLanguage: "User Language",
    },
    {
      StartDate: '{"ImportId":"startDate","timeZone":"UTC"}',
      EndDate: '{"ImportId":"endDate","timeZone":"UTC"}',
      Status: '{"ImportId":"status"}',
      Progress: '{"ImportId":"progress"}',
      Duration: '{"ImportId":"duration"}',
      Finished: '{"ImportId":"finished"}',
      RecordedDate: '{"ImportId":"recordedDate","timeZone":"UTC"}',
      ResponseId: '{"ImportId":"_recordId"}',
      RecipientEmail: '{"ImportId":"recipientEmail"}',
      ExternalReference: '{"ImportId":"externalReference"}',
      QID1: '{"ImportId":"QID1"}',
      QID2_1: '{"ImportId":"QID2_1"}',
      QID2_2: '{"ImportId":"QID2_2"}',
      QID2_3: '{"ImportId":"QID2_3"}',
      QID3_TEXT: '{"ImportId":"QID3_TEXT"}',
      QID4: '{"ImportId":"QID4"}',
      userLanguage: '{"ImportId":"userLanguage"}',
    },
  ];

  for (let i = 0; i < submissions; i++) {
    const language = generator.pick(languages);
    const startDate = generator.dateWithinDays(40, generator.int(1, 90));
    const endDate = new Date(startDate.getTime() + generator.int(45, 720) * 1000);
    const firstName = generator.pick(firstNames);
    const lastName = generator.pick(lastNames);

    rows.push({
      StartDate: startDate.toISOString(),
      EndDate: endDate.toISOString(),
      Status: generator.pick(["IP Address", "Survey Preview", "Spam", "Imported"]),
      Progress: generator.pick([100, 100, 100, 80, 50]),
      Duration: generator.int(35, 2500),
      Finished: generator.pick(["True", "True", "True", "False"]),
      RecordedDate: endDate.toISOString(),
      ResponseId: generator.id("R", i),
      RecipientEmail: generator.email(firstName, lastName),
      ExternalReference: generator.id("crm", generator.int(1, 8000)),
      QID1: generator.int(0, 10),
      QID2_1: generator.int(1, 5),
      QID2_2: generator.int(1, 5),
      QID2_3: generator.int(1, 5),
      QID3_TEXT: textValue(generator, language),
      QID4: generator.pick(["Yes", "No"]),
      userLanguage: language,
    });
  }

  return rows;
};

const createCustomCrmRows = (generator: DataGenerator, submissions: number): CsvRow[] => {
  const rows: CsvRow[] = [];

  for (let i = 0; i < submissions; i++) {
    const language = generator.pick(languages);
    const ticketId = generator.id("ticket", i);

    rows.push({
      event_time: generator.pick([
        generator.iso(30),
        generator.localDate(30),
        generator.iso(30).replace("T", " "),
      ]),
      customer_id: generator.id("cust", generator.int(1, 9999)),
      ticket_id: ticketId,
      account_plan: generator.pick(plans),
      source: generator.pick(["Zendesk", "Intercom", "Freshdesk", "HubSpot"]),
      source_url: `https://support.example.test/tickets/${ticketId}`,
      agent_team: generator.pick(["Tier 1", "Billing", "Technical Support", "Success"]),
      sentiment_score: generator.pick(["0.91", "-0.12", "neutral", "0", "1"]),
      priority: generator.pick(["low", "normal", "high", "urgent"]),
      escalated: generator.pick(["true", "false", "yes", "no", ""]),
      reason_code: generator.pick(["billing_issue", "bug", "how_to", "feature_request", "cancellation"]),
      customer_comment: textValue(generator, language),
      metadata: generator.chance(0.15)
        ? "not valid JSON but still useful as raw metadata"
        : metadata(generator, { ticket_id: ticketId, source: "support_tool" }),
      locale: language,
    });
  }

  return rows;
};

const createEdgeCaseRows = (generator: DataGenerator): CsvRow[] => [
  {
    collected_at: "2026-05-01T10:00:00Z",
    submission_id: "edge-001",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_valid_text",
    field_label: "Valid text with quotes and commas",
    field_type: "text",
    response: 'Works, but includes "quotes", commas, and a newline\ninside the answer.',
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-001",
    metadata: metadata(generator, { expected: "imports" }),
  },
  {
    collected_at: "not-a-date",
    submission_id: "edge-002",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_invalid_collected_at",
    field_label: "Invalid collected_at should be omitted by transform",
    field_type: "text",
    response: "The record can still import because collected_at is optional at transform time.",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-002",
    metadata: metadata(generator, { expected: "imports_without_collected_at" }),
  },
  {
    collected_at: "2026-05-01",
    submission_id: "edge-003",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_bad_number",
    field_label: "Invalid numeric response",
    field_type: "nps",
    response: "ten",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-003",
    metadata: metadata(generator, { expected: "imports_without_value_number" }),
  },
  {
    collected_at: "2026-05-02T12:30:00Z",
    submission_id: "",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_empty_submission",
    field_label: "Empty mapped submission_id should skip when submission_id is mapped",
    field_type: "text",
    response: "This row is useful when QA maps submission_id explicitly.",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-004",
    metadata: metadata(generator, { expected: "skips_if_submission_id_mapped" }),
  },
  {
    collected_at: "2026-05-02T12:31:00Z",
    submission_id: "edge-005",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "",
    field_label: "Missing field id",
    field_type: "text",
    response: "Required field_id missing, so transform should skip.",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-005",
    metadata: metadata(generator, { expected: "skips" }),
  },
  {
    collected_at: "2026-05-02T12:32:00Z",
    submission_id: "edge-006",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_invalid_field_type",
    field_label: "Invalid field type",
    field_type: "likert",
    response: "5",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-006",
    metadata: metadata(generator, { expected: "enum_validation_error_or_skip" }),
  },
  {
    collected_at: "2026-05-02T12:33:00Z",
    submission_id: "edge-007",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_boolean_maybe",
    field_label: "Unsupported boolean spelling",
    field_type: "boolean",
    response: "maybe",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-007",
    metadata: metadata(generator, { expected: "imports_without_value_boolean" }),
  },
  {
    collected_at: "2026-05-02T12:34:00Z",
    submission_id: "edge-008",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_metadata_raw",
    field_label: "Non-JSON metadata",
    field_type: "text",
    response: "Metadata should be wrapped as raw.",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-008",
    metadata: "utm_source=newsletter; plan=enterprise",
  },
  {
    collected_at: "2026-05-02T12:35:00Z",
    submission_id: "edge-009",
    source_id: "edge_case_suite",
    source_name: "CSV Import Edge Cases",
    field_id: "q_date_us_format",
    field_label: "US-style date response",
    field_type: "date",
    response: "05/07/2026",
    field_group_id: "",
    field_group_label: "",
    language: "en",
    user_identifier: "qa-user-009",
    metadata: metadata(generator, { expected: "date_parser_dependent" }),
  },
];

const createTooManyRows = (): string => {
  const headers = ["collected_at", "field_id", "field_label", "field_type", "response", "language"];
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    collected_at: "2026-05-07T10:00:00.000Z",
    field_id: `too_many_${i + 1}`,
    field_label: `Too many row ${i + 1}`,
    field_type: "text",
    response: `Row ${i + 1}`,
    language: "en",
  }));
  return toCsv(headers, rows);
};

const createFiles = (options: Options): OutputFile[] => {
  const generator = new DataGenerator(options.seed);
  const hubReadySubmissions = Math.min(options.submissions, MAX_HUB_READY_SUBMISSIONS);
  const hubHeaders = [
    "collected_at",
    "submission_id",
    "source_id",
    "source_name",
    "field_id",
    "field_label",
    "field_type",
    "response",
    "field_group_id",
    "field_group_label",
    "language",
    "user_identifier",
    "metadata",
  ];

  return [
    {
      name: "01-formbricks-hub-ready-long.csv",
      description: "One row per feedback field, matching the CSV mapping UI target model.",
      usage: [
        "Use this as the primary happy-path fixture for the CSV connector.",
        "Suggested mappings: collected_at -> Collected At, field_id -> Field ID, field_label -> Field Label, field_type -> Field Type, response -> Response.",
        "Optional mappings: submission_id, source_id, source_name, field_group_id, field_group_label, language, user_identifier, metadata.",
        `This fixture is capped at ${MAX_HUB_READY_SUBMISSIONS} submissions so it stays below the CSV importer's 1,000-record limit.`,
        "Covers text, categorical, nps, csat, ces, rating, boolean, date, matrix-style groups, multilingual answers, JSON metadata, quoted text, commas, and embedded newlines.",
      ],
      content: toCsv(hubHeaders, createHubReadyRows(generator, hubReadySubmissions)),
    },
    {
      name: "02-typeform-product-feedback-wide.csv",
      description: "Typeform-style response export with hidden fields, multi-selects, and long text.",
      usage: [
        "Use this to QA mapping from a wide survey export where each submission is one row and each question is a column.",
        "Good mapping candidates: Response ID -> submission_id, Submitted At -> collected_at, Language -> language, Hidden: account_id -> user_identifier.",
        "Question columns can be mapped one at a time to Response with static field_type values, or transformed into long format outside the app.",
        "Covers hidden fields, nullable email values, multi-select text, localized feedback, quotes, commas, and embedded newlines.",
      ],
      content: toCsv(
        [
          "Response ID",
          "Submitted At",
          "Landed At",
          "Network ID",
          "What best describes your role?",
          "How likely are you to recommend us?",
          "What made you choose that score?",
          "Feature satisfaction",
          "Which features do you use?",
          "May we contact you?",
          "Email",
          "Language",
          "Hidden: plan",
          "Hidden: account_id",
          "Hidden: signed_up_at",
        ],
        createTypeformWideRows(generator, options.submissions)
      ),
    },
    {
      name: "03-surveymonkey-csat-export.csv",
      description:
        "SurveyMonkey-like export with collector metadata, duplicate-ish labels, and mixed boolean values.",
      usage: [
        "Use this to QA source-field discovery and manual mapping on verbose third-party column names.",
        "Good mapping candidates: Respondent ID -> submission_id, End Date -> collected_at, Locale -> language, Custom Data 1 -> source_id, Custom Data 2 -> metadata or source context.",
        "The duplicate-style Other columns and mixed true/false/1/0/not applicable values are intentional.",
      ],
      content: toCsv(
        [
          "Respondent ID",
          "Collector ID",
          "Start Date",
          "End Date",
          "IP Address",
          "Custom Data 1",
          "Custom Data 2",
          "Q1: Overall, how satisfied are you with our product?",
          "Q2: Why did you choose that answer?",
          "Q3: Which team uses the product most?",
          "Q4: Did you contact support?",
          "Q5: Support ticket resolved?",
          "Other (please specify)",
          "Other (please specify).1",
          "Tags",
          "Locale",
        ],
        createSurveyMonkeyRows(generator, options.submissions)
      ),
    },
    {
      name: "04-google-forms-multilingual-export.csv",
      description: "Google Forms-like export with non-English column names and localized answer labels.",
      usage: [
        "Use this to QA non-English headers, Unicode values, and localized boolean/date answers.",
        "Good mapping candidates: Marca temporal -> collected_at, Dirección de correo electrónico -> user_identifier, 言語 / Idioma -> language.",
        "Question columns intentionally mix German, Spanish, French, Portuguese, Japanese, and Chinese labels.",
      ],
      content: toCsv(
        [
          "Marca temporal",
          "Dirección de correo electrónico",
          "Wie zufrieden bist du mit dem Onboarding?",
          "¿Qué deberíamos mejorar?",
          "Quelle fonctionnalité utilisez-vous le plus ?",
          "Você autorizou contato de acompanhamento?",
          "次回更新日はいつですか？",
          "言語 / Idioma",
          "Plano",
          "Notas internas",
        ],
        createGoogleFormsRows(generator, options.submissions)
      ),
    },
    {
      name: "05-qualtrics-matrix-export.csv",
      description: "Qualtrics-like export with question/import-id metadata rows before real responses.",
      usage: [
        "Use this to QA exports that include non-response metadata rows directly after the header.",
        "The first two data rows are Qualtrics-style label/import-id rows and should usually be skipped or cleaned before import.",
        "Good mapping candidates after cleanup: ResponseId -> submission_id, RecordedDate -> collected_at, userLanguage -> language, QID fields -> responses.",
      ],
      content: toCsv(
        [
          "StartDate",
          "EndDate",
          "Status",
          "Progress",
          "Duration",
          "Finished",
          "RecordedDate",
          "ResponseId",
          "RecipientEmail",
          "ExternalReference",
          "QID1",
          "QID2_1",
          "QID2_2",
          "QID2_3",
          "QID3_TEXT",
          "QID4",
          "userLanguage",
        ],
        createQualtricsMatrixRows(generator, options.submissions)
      ),
    },
    {
      name: "06-custom-support-tool-export.csv",
      description:
        "Custom support/CRM export with ticket IDs, sentiment, malformed metadata, and varied dates.",
      usage: [
        "Use this to QA CSVs from custom support tools rather than survey vendors.",
        "Good mapping candidates: event_time -> collected_at, ticket_id -> submission_id/source_id, customer_id -> user_identifier, customer_comment -> Response.",
        "Covers mixed date formats, numeric-looking sentiment values plus text, support metadata, priorities, booleans, and malformed JSON metadata.",
      ],
      content: toCsv(
        [
          "event_time",
          "customer_id",
          "ticket_id",
          "account_plan",
          "source",
          "source_url",
          "agent_team",
          "sentiment_score",
          "priority",
          "escalated",
          "reason_code",
          "customer_comment",
          "metadata",
          "locale",
        ],
        createCustomCrmRows(generator, options.submissions)
      ),
    },
    {
      name: "07-edge-cases-hub-ready.csv",
      description:
        "Consistent columns but intentionally tricky values: invalid dates, missing IDs, bad enums, raw metadata.",
      usage: [
        "Use this after the happy-path fixture to verify skipped rows, coercion behavior, enum validation, and metadata fallback.",
        "Suggested mappings are the same as 01-formbricks-hub-ready-long.csv.",
        "Rows intentionally include invalid collected_at, invalid nps response, empty submission_id, missing field_id, invalid field_type, unsupported boolean spelling, non-JSON metadata, and US-style dates.",
      ],
      content: toCsv(hubHeaders, createEdgeCaseRows(generator)),
    },
    {
      name: "08-invalid-unclosed-quote.csv",
      description: "Parser failure: an unclosed quoted value.",
      usage: [
        "Use this to verify the CSV upload shows a clear parse error.",
        "This file is intentionally not importable.",
      ],
      content:
        'collected_at,field_id,field_label,field_type,response\n2026-05-07T10:00:00Z,q1,Question,text,"This starts but never closes\n',
    },
    {
      name: "09-invalid-inconsistent-columns.csv",
      description: "Parser/schema failure: row lengths do not match the header.",
      usage: [
        "Use this to verify malformed row length handling.",
        "This file is intentionally not importable.",
      ],
      content:
        "collected_at,field_id,field_label,field_type,response\n2026-05-07T10:00:00Z,q1,Question,text,ok\n2026-05-07T10:01:00Z,q2,Question,text,extra value,unexpected\n",
    },
    {
      name: "10-invalid-empty-header.csv",
      description: "Schema failure: one column header is empty.",
      usage: [
        "Use this to verify the empty-column-header validation message.",
        "This file is intentionally not importable.",
      ],
      content:
        ",field_id,field_label,field_type,response\n2026-05-07T10:00:00Z,q1,Question,text,The first header is blank\n",
    },
    {
      name: "11-invalid-too-many-rows-1001.csv",
      description: "Schema failure: exceeds the current 1,000-row CSV limit.",
      usage: [
        "Use this to verify the maximum-records validation message.",
        "This file is intentionally over the current 1,000-row limit.",
      ],
      content: createTooManyRows(),
    },
  ];
};

const main = async () => {
  const options = parseOptions();
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outputDir = join(scriptDir, "generated-csv");

  if (options.clean) {
    await rm(outputDir, { force: true, recursive: true });
  }

  await mkdir(outputDir, { recursive: true });

  const files = createFiles(options);
  for (const file of files) {
    await writeFile(join(outputDir, file.name), file.content);
  }

  console.log(`Generated ${files.length} CSV files in ${outputDir}`);
  console.log(`Seed: ${options.seed}; submissions per realistic source: ${options.submissions}`);
  if (options.submissions > MAX_HUB_READY_SUBMISSIONS) {
    console.log(
      `01-formbricks-hub-ready-long.csv was capped at ${MAX_HUB_READY_SUBMISSIONS} submissions to stay below 1,000 importable records.`
    );
  }
  console.log("");

  for (const file of files) {
    const lines = file.content.split("\n").length - 1;
    console.log(`${file.name.padEnd(42)} ${String(lines).padStart(5)} lines  ${file.description}`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
