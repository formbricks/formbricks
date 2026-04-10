import {
  type ExportableSurvey,
  type ExportableQuestion,
  type ExportableChoice,
  type ExportableMatrix,
  type ExportableRatingScale,
  type ExportableNpsScale,
  type ExportableFieldConfig,
} from "./types";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    draft: "background:#f3f4f6;color:#374151",
    inProgress: "background:#dbeafe;color:#1e40af",
    paused: "background:#fef3c7;color:#92400e",
    completed: "background:#d1fae5;color:#065f46",
    archived: "background:#e5e7eb;color:#6b7280",
  };
  const style = colors[status] || "background:#f3f4f6;color:#374151";
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;letter-spacing:0.3px;${style}">${esc(status.toUpperCase())}</span>`;
}

// --- Question type renderers ---

function renderChoices(choices: ExportableChoice[], isSingle: boolean): string {
  const marker = isSingle ? "radio" : "checkbox";
  return `<div class="choices">${choices
    .map(
      (c) =>
        `<label class="choice-item">
        <span class="${marker}-marker"></span>
        <span>${esc(c.label)}${c.isOther ? ' <span class="other-tag">Other</span>' : ""}</span>
      </label>`
    )
    .join("")}</div>`;
}

function renderRanking(choices: ExportableChoice[]): string {
  return `<div class="ranking">${choices
    .map(
      (c, i) =>
        `<div class="rank-item">
        <span class="rank-handle">&#9776;</span>
        <span class="rank-num">${i + 1}</span>
        <span>${esc(c.label)}</span>
      </div>`
    )
    .join("")}</div>`;
}

function renderNps(nps: ExportableNpsScale): string {
  let html = `<div class="nps-scale">`;
  for (let i = 0; i <= 10; i++) {
    const cls = i <= 6 ? "nps-detractor" : i <= 8 ? "nps-passive" : "nps-promoter";
    html += `<div class="nps-cell ${cls}">${i}</div>`;
  }
  html += `</div>`;
  if (nps.lowerLabel || nps.upperLabel) {
    html += `<div class="scale-labels"><span>${esc(nps.lowerLabel || "")}</span><span>${esc(nps.upperLabel || "")}</span></div>`;
  }
  return html;
}

function renderRating(rating: ExportableRatingScale): string {
  let html = `<div class="rating-scale">`;
  for (let i = 1; i <= rating.range; i++) {
    if (rating.style === "star") {
      html += `<span class="rating-star">&#9734;</span>`;
    } else if (rating.style === "smiley") {
      const smileys = ["&#128542;", "&#128533;", "&#128528;", "&#128578;", "&#128513;"];
      const idx = Math.round(((i - 1) / (rating.range - 1)) * 4);
      html += `<span class="rating-smiley">${smileys[idx]}</span>`;
    } else {
      html += `<span class="rating-number">${i}</span>`;
    }
  }
  html += `</div>`;
  if (rating.lowerLabel || rating.upperLabel) {
    html += `<div class="scale-labels"><span>${esc(rating.lowerLabel || "")}</span><span>${esc(rating.upperLabel || "")}</span></div>`;
  }
  return html;
}

function renderMatrix(matrix: ExportableMatrix): string {
  let html = `<table class="matrix-table"><thead><tr><th></th>`;
  for (const col of matrix.columns) {
    html += `<th>${esc(col)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  for (const row of matrix.rows) {
    html += `<tr><td class="matrix-row-label">${esc(row)}</td>`;
    for (let c = 0; c < matrix.columns.length; c++) {
      html += `<td class="matrix-cell">○</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderTextInput(config: { type: string; longAnswer: boolean; placeholder?: string }): string {
  const ph = config.placeholder ? esc(config.placeholder) : "";
  if (config.longAnswer) {
    return `<div class="text-input textarea-input">${ph || "Type your answer here..."}</div>`;
  }
  const typeLabel =
    config.type !== "text" ? ` <span class="input-type-hint">(${esc(config.type)})</span>` : "";
  return `<div class="text-input">${ph || "Type your answer here..."}${typeLabel}</div>`;
}

function renderFormFields(fields: ExportableFieldConfig[]): string {
  let html = `<div class="form-fields">`;
  for (const f of fields) {
    html += `<div class="form-field">
      <label class="field-label">${esc(f.name)}${f.required ? ' <span class="req">*</span>' : ""}</label>
      <div class="text-input">${f.placeholder ? esc(f.placeholder) : ""}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderConsent(label: string): string {
  return `<label class="choice-item"><span class="checkbox-marker"></span><span>${esc(label)}</span></label>`;
}

function renderDate(): string {
  return `<div class="date-input"><span class="date-icon">&#128197;</span> <span class="date-placeholder">MM / DD / YYYY</span></div>`;
}

function renderFileUpload(): string {
  return `<div class="file-upload"><div class="file-upload-icon">&#128206;</div><div>Click or drag to upload files</div></div>`;
}

function renderQuestionWidget(q: ExportableQuestion): string {
  const { elementType } = q;

  if ((elementType === "multipleChoiceSingle" || elementType === "multipleChoiceMulti") && q.choices) {
    return renderChoices(q.choices, elementType === "multipleChoiceSingle");
  }
  if (elementType === "ranking" && q.choices) {
    return renderRanking(q.choices);
  }
  if (elementType === "nps" && q.npsScale) {
    return renderNps(q.npsScale);
  }
  if (elementType === "rating" && q.ratingScale) {
    return renderRating(q.ratingScale);
  }
  if (elementType === "matrix" && q.matrix) {
    return renderMatrix(q.matrix);
  }
  if (elementType === "openText" && q.inputConfig) {
    return renderTextInput(q.inputConfig);
  }
  if (elementType === "consent" && q.consentLabel) {
    return renderConsent(q.consentLabel);
  }
  if (elementType === "date") {
    return renderDate();
  }
  if (elementType === "fileUpload") {
    return renderFileUpload();
  }
  if (elementType === "address" && q.addressFields) {
    return renderFormFields(q.addressFields);
  }
  if (elementType === "contactInfo" && q.contactFields) {
    return renderFormFields(q.contactFields);
  }
  return "";
}

// --- Main generator ---

export function generateSurveyHtml(data: ExportableSurvey): string {
  let body = "";

  // Welcome card
  if (data.welcomeCard) {
    body += `
    <div class="card welcome-card">
      <div class="card-label">Welcome Screen</div>
      ${data.welcomeCard.headline ? `<h3 class="q-headline">${esc(data.welcomeCard.headline)}</h3>` : ""}
      ${data.welcomeCard.subheader ? `<p class="q-sub">${esc(data.welcomeCard.subheader)}</p>` : ""}
      ${data.welcomeCard.buttonLabel ? `<div class="btn-preview">${esc(data.welcomeCard.buttonLabel)}</div>` : ""}
    </div>`;
  }

  // Sections / Questions
  for (const section of data.sections) {
    body += `<div class="section"><h2 class="section-title">${esc(section.name)}</h2>`;

    if (section.logic && section.logic.length > 0) {
      body += `<div class="logic-box"><div class="logic-title">Block Logic</div>`;
      for (const rule of section.logic) {
        body += `<div class="logic-rule">${esc(rule.summary)}</div>`;
      }
      body += `</div>`;
    }

    for (const q of section.questions) {
      body += `
      <div class="card question-card">
        <div class="question-header">
          <span class="question-number">Q${q.index}</span>
          <span class="type-badge">${esc(q.type)}</span>
          ${q.required ? '<span class="req-badge">Required</span>' : '<span class="opt-badge">Optional</span>'}
        </div>
        <h3 class="q-headline">${esc(q.headline)}</h3>
        ${q.subheader ? `<p class="q-sub">${esc(q.subheader)}</p>` : ""}
        <div class="widget-area">${renderQuestionWidget(q)}</div>`;

      if (q.details.length > 0) {
        body += `<div class="details-section">`;
        for (const d of q.details) {
          body += `<span class="detail-chip"><strong>${esc(d.label)}:</strong> ${esc(d.value)}</span>`;
        }
        body += `</div>`;
      }

      if (q.logic && q.logic.length > 0) {
        body += `<div class="logic-box"><div class="logic-title">Skip Logic</div>`;
        for (const rule of q.logic) {
          body += `<div class="logic-rule">${esc(rule.summary)}</div>`;
        }
        body += `</div>`;
      }

      body += `</div>`;
    }
    body += `</div>`;
  }

  // Endings
  if (data.endings.length > 0) {
    body += `<div class="section"><h2 class="section-title">Endings</h2>`;
    for (const ending of data.endings) {
      body += `<div class="card ending-card">`;
      if (ending.type === "endScreen") {
        body += `<div class="card-label">End Screen</div>`;
        if (ending.headline) body += `<h3 class="q-headline">${esc(ending.headline)}</h3>`;
        if (ending.subheader) body += `<p class="q-sub">${esc(ending.subheader)}</p>`;
        if (ending.buttonLabel) body += `<div class="btn-preview">${esc(ending.buttonLabel)}</div>`;
      } else {
        body += `<div class="card-label">Redirect</div>`;
        if (ending.headline) body += `<p><strong>Label:</strong> ${esc(ending.headline)}</p>`;
        if (ending.redirectUrl) body += `<p><strong>URL:</strong> ${esc(ending.redirectUrl)}</p>`;
      }
      body += `</div>`;
    }
    body += `</div>`;
  }

  // Hidden Fields & Variables
  if (data.hiddenFields.length > 0 || data.variables.length > 0) {
    body += `<div class="section"><h2 class="section-title">Configuration</h2>`;
    if (data.hiddenFields.length > 0) {
      body += `<div class="card"><div class="card-label">Hidden Fields</div><div class="chip-list">${data.hiddenFields.map((f) => `<span class="detail-chip">${esc(f)}</span>`).join("")}</div></div>`;
    }
    if (data.variables.length > 0) {
      body += `<div class="card"><div class="card-label">Variables</div><div class="chip-list">${data.variables.map((v) => `<span class="detail-chip"><strong>${esc(v.name)}</strong> (${esc(v.type)}, default: ${esc(String(v.value))})</span>`).join("")}</div></div>`;
    }
    body += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.name)} - Survey Export</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b; background: #f8fafc; line-height: 1.6;
  }
  .header {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white; padding: 48px 40px 40px; margin-bottom: 32px;
  }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.5px; }
  .header-meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 14px; opacity: 0.85; }
  .container { max-width: 720px; margin: 0 auto; padding: 0 24px 48px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 18px; font-weight: 700; color: #0f172a; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; margin-bottom: 16px; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
  .welcome-card { border-left: 4px solid #3b82f6; }
  .ending-card { border-left: 4px solid #8b5cf6; }
  .question-card { border-left: 4px solid #0ea5e9; }
  .question-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .question-number { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 28px; padding: 0 8px; border-radius: 6px; background: #0ea5e9; color: white; font-size: 12px; font-weight: 700; }
  .type-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #ede9fe; color: #5b21b6; }
  .req-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #fee2e2; color: #991b1b; }
  .opt-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #f1f5f9; color: #94a3b8; }
  .q-headline { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 4px; white-space: pre-line; }
  .q-sub { font-size: 14px; color: #64748b; margin-bottom: 12px; white-space: pre-line; }
  .widget-area { margin-top: 12px; }
  .choices { display: flex; flex-direction: column; gap: 6px; }
  .choice-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #334155; }
  .radio-marker { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd5e1; flex-shrink: 0; }
  .checkbox-marker { width: 18px; height: 18px; border-radius: 4px; border: 2px solid #cbd5e1; flex-shrink: 0; }
  .other-tag { font-size: 10px; padding: 1px 6px; background: #f1f5f9; border-radius: 4px; color: #94a3b8; }
  .ranking { display: flex; flex-direction: column; gap: 6px; }
  .rank-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #334155; background: #fafafa; }
  .rank-handle { color: #cbd5e1; font-size: 14px; }
  .rank-num { font-size: 11px; font-weight: 700; color: #94a3b8; min-width: 20px; }
  .nps-scale { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
  .nps-cell { flex: 1; text-align: center; padding: 10px 0; font-size: 13px; font-weight: 600; border-right: 1px solid #e2e8f0; color: white; }
  .nps-cell:last-child { border-right: none; }
  .nps-detractor { background: #fee2e2; color: #991b1b; }
  .nps-passive { background: #fef3c7; color: #92400e; }
  .nps-promoter { background: #d1fae5; color: #065f46; }
  .scale-labels { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-top: 6px; }
  .rating-scale { display: flex; gap: 8px; align-items: center; }
  .rating-star { font-size: 28px; color: #fbbf24; }
  .rating-smiley { font-size: 28px; }
  .rating-number { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 600; color: #64748b; }
  .matrix-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .matrix-table th { padding: 8px 12px; text-align: center; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px; }
  .matrix-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .matrix-row-label { font-weight: 500; color: #334155; text-align: left; }
  .matrix-cell { text-align: center; }
  .matrix-table tr:last-child td { border-bottom: none; }
  .matrix-table tr:nth-child(even) { background: #fafafa; }
  .text-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 14px; color: #94a3b8; background: #fafafa; }
  .textarea-input { min-height: 80px; }
  .input-type-hint { font-size: 11px; color: #cbd5e1; }
  .form-fields { display: flex; flex-direction: column; gap: 10px; }
  .field-label { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; display: block; }
  .field-label .req { color: #dc2626; }
  .date-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 14px; color: #94a3b8; background: #fafafa; display: inline-flex; align-items: center; gap: 8px; }
  .file-upload { border: 2px dashed #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; color: #94a3b8; font-size: 14px; }
  .file-upload-icon { font-size: 24px; margin-bottom: 4px; }
  .details-section { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .detail-chip { display: inline-block; padding: 3px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #64748b; }
  .chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .logic-box { margin-top: 12px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
  .logic-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; }
  .logic-rule { font-size: 13px; color: #475569; padding: 3px 0; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }
  .btn-preview { display: inline-block; margin-top: 8px; padding: 8px 20px; background: #0f172a; color: white; border-radius: 8px; font-size: 14px; font-weight: 500; }
  .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 24px; }
  @media print {
    body { background: white; }
    .header { padding: 24px; margin-bottom: 16px; break-after: avoid; }
    .card { box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
    .question-card { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${esc(data.name)}</h1>
  <div class="header-meta">
    <span>Created: ${formatDate(data.createdAt)}</span>
    <span>Status: ${statusBadge(data.status)}</span>
    <span>Type: ${esc(data.type)}</span>
    <span>Questions: ${data.sections.reduce((sum, s) => sum + s.questions.length, 0)}</span>
  </div>
</div>
<div class="container">
${body}
</div>
<div class="footer">Exported from Formbricks on ${formatDate(new Date())}</div>
</body>
</html>`;
}
