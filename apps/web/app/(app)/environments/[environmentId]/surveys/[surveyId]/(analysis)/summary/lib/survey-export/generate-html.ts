import { type ExportableSurvey } from "./types";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;letter-spacing:0.3px;${style}">${escapeHtml(status.toUpperCase())}</span>`;
}

function typeBadge(type: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#ede9fe;color:#5b21b6;letter-spacing:0.2px">${escapeHtml(type)}</span>`;
}

function requiredBadge(required: boolean): string {
  if (!required) return "";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b">REQUIRED</span>`;
}

export function generateSurveyHtml(data: ExportableSurvey): string {
  let body = "";

  // Welcome card
  if (data.welcomeCard) {
    body += `
    <div class="card welcome-card">
      <div class="card-label">Welcome Screen</div>
      ${data.welcomeCard.headline ? `<h3 style="margin:8px 0 4px">${escapeHtml(data.welcomeCard.headline)}</h3>` : ""}
      ${data.welcomeCard.subheader ? `<p style="color:#64748b;margin:0 0 8px">${escapeHtml(data.welcomeCard.subheader)}</p>` : ""}
      ${data.welcomeCard.buttonLabel ? `<p style="margin:0"><strong>Button:</strong> ${escapeHtml(data.welcomeCard.buttonLabel)}</p>` : ""}
    </div>`;
  }

  // Sections / Questions
  for (const section of data.sections) {
    body += `
    <div class="section">
      <h2 class="section-title">${escapeHtml(section.name)}</h2>`;

    if (section.buttonLabel) {
      body += `<p class="section-meta"><strong>Next Button:</strong> ${escapeHtml(section.buttonLabel)}</p>`;
    }

    // Section-level logic (block logic)
    if (section.logic && section.logic.length > 0) {
      body += `<div class="logic-box"><div class="logic-title">Block Logic</div>`;
      for (const rule of section.logic) {
        body += `<div class="logic-rule">${escapeHtml(rule.summary)}</div>`;
      }
      body += `</div>`;
    }

    for (const q of section.questions) {
      body += `
      <div class="card question-card">
        <div class="question-header">
          <span class="question-number">Q${q.index}</span>
          ${typeBadge(q.type)}
          ${requiredBadge(q.required)}
        </div>
        <h3 class="question-headline">${escapeHtml(q.headline)}</h3>
        ${q.subheader ? `<p class="question-subheader">${escapeHtml(q.subheader)}</p>` : ""}`;

      if (q.details.length > 0) {
        body += `<div class="details-table">`;
        for (const d of q.details) {
          if (d.items && d.items.length > 0) {
            body += `
            <div class="detail-row">
              <div class="detail-label">${escapeHtml(d.label)}</div>
              <div class="detail-value">
                <ul class="choice-list">
                  ${d.items.map((item, i) => `<li><span class="choice-marker">${i + 1}.</span> ${escapeHtml(item)}</li>`).join("")}
                </ul>
              </div>
            </div>`;
          } else {
            body += `
            <div class="detail-row">
              <div class="detail-label">${escapeHtml(d.label)}</div>
              <div class="detail-value">${escapeHtml(d.value)}</div>
            </div>`;
          }
        }
        body += `</div>`;
      }

      // Question-level logic (legacy)
      if (q.logic && q.logic.length > 0) {
        body += `<div class="logic-box"><div class="logic-title">Skip Logic</div>`;
        for (const rule of q.logic) {
          body += `<div class="logic-rule">${escapeHtml(rule.summary)}</div>`;
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
        if (ending.headline) body += `<h3 style="margin:8px 0 4px">${escapeHtml(ending.headline)}</h3>`;
        if (ending.subheader)
          body += `<p style="color:#64748b;margin:0 0 8px">${escapeHtml(ending.subheader)}</p>`;
        if (ending.buttonLabel)
          body += `<p style="margin:0"><strong>Button:</strong> ${escapeHtml(ending.buttonLabel)}</p>`;
      } else {
        body += `<div class="card-label">Redirect</div>`;
        if (ending.headline)
          body += `<p style="margin:4px 0"><strong>Label:</strong> ${escapeHtml(ending.headline)}</p>`;
        if (ending.redirectUrl)
          body += `<p style="margin:4px 0"><strong>URL:</strong> ${escapeHtml(ending.redirectUrl)}</p>`;
      }
      body += `</div>`;
    }
    body += `</div>`;
  }

  // Hidden Fields & Variables
  if (data.hiddenFields.length > 0 || data.variables.length > 0) {
    body += `<div class="section"><h2 class="section-title">Configuration</h2>`;
    if (data.hiddenFields.length > 0) {
      body += `
      <div class="card">
        <div class="card-label">Hidden Fields</div>
        <ul class="choice-list" style="margin-top:8px">
          ${data.hiddenFields.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>`;
    }
    if (data.variables.length > 0) {
      body += `
      <div class="card">
        <div class="card-label">Variables</div>
        <div class="details-table" style="margin-top:8px">
          ${data.variables
            .map(
              (v) => `
            <div class="detail-row">
              <div class="detail-label">${escapeHtml(v.name)}</div>
              <div class="detail-value">${escapeHtml(v.type)} (default: ${escapeHtml(String(v.value))})</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>`;
    }
    body += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.name)} - Survey Export</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    line-height: 1.6;
    padding: 0;
  }
  .header {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
    padding: 48px 40px 40px;
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }
  .header-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    font-size: 14px;
    opacity: 0.85;
  }
  .header-meta span { display: flex; align-items: center; gap: 6px; }
  .container { max-width: 800px; margin: 0 auto; padding: 0 24px 48px; }
  .section { margin-bottom: 32px; }
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    padding-bottom: 10px;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 16px;
    letter-spacing: -0.3px;
  }
  .section-meta { font-size: 13px; color: #64748b; margin-bottom: 12px; }
  .card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s;
  }
  .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .card-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .welcome-card { border-left: 4px solid #3b82f6; }
  .ending-card { border-left: 4px solid #8b5cf6; }
  .question-card { border-left: 4px solid #0ea5e9; }
  .question-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .question-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #0ea5e9;
    color: white;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .question-headline {
    font-size: 16px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .question-subheader {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 12px;
  }
  .details-table { margin-top: 12px; }
  .detail-row {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-label {
    width: 160px;
    flex-shrink: 0;
    font-weight: 600;
    color: #475569;
  }
  .detail-value { color: #334155; flex: 1; }
  .choice-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .choice-list li {
    padding: 3px 0;
    font-size: 14px;
    color: #334155;
  }
  .choice-marker {
    display: inline-block;
    width: 22px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
  }
  .logic-box {
    margin-top: 12px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .logic-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .logic-rule {
    font-size: 13px;
    color: #475569;
    padding: 4px 0;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  }
  .footer {
    text-align: center;
    padding: 24px;
    font-size: 12px;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    margin-top: 24px;
  }

  @media print {
    body { background: white; }
    .header { padding: 24px; margin-bottom: 16px; break-after: avoid; }
    .card { box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
    .section { break-inside: avoid-page; }
    .question-card { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(data.name)}</h1>
  <div class="header-meta">
    <span>Created: ${formatDate(data.createdAt)}</span>
    <span>Status: ${statusBadge(data.status)}</span>
    <span>Type: ${escapeHtml(data.type)}</span>
    <span>Questions: ${data.sections.reduce((sum, s) => sum + s.questions.length, 0)}</span>
  </div>
</div>
<div class="container">
${body}
</div>
<div class="footer">
  Exported from Formbricks on ${formatDate(new Date())}
</div>
</body>
</html>`;
}
