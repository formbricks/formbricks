import { sendEmail } from "@/app/lib/email";
import { withEmailTemplate } from "@/app/lib/email-template";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { Insights, NotificationResponse, Survey, SurveyResponse } from "./types";

const getEmailSubject = (productName: string) => {
  return `${productName} User Insights - Last Week by Formbricks`;
};

const notificationHeader = (
  productName: string,
  startDate: string,
  endDate: string,
  startYear: number,
  endYear: number
) =>
  `
  <div style="display: block; padding: 1rem;">
    <div style="float: left;">
        <h1>Hey 👋</h1>
    </div>
    <div style="float: right;">    
        <p style="text-align: right; margin: 0; font-weight: 600;">Weekly Report for ${productName}</p>
        ${getNotificationHeaderimePeriod(startDate, endDate, startYear, endYear)}
    </div>
  </div>
  <br/>
  <br/>
  `;

const getNotificationHeaderimePeriod = (
  startDate: string,
  endDate: string,
  startYear: number,
  endYear: number
) => {
  if (startYear == endYear) {
    return `<p style="text-align: right; margin: 0;">${startDate} - ${endDate} ${endYear}</p>`;
  } else {
    return `<p style="text-align: right; margin: 0;">${startDate} ${startYear} - ${endDate} ${endYear}</p>`;
  }
};

const notificationInsight = (insights: Insights) =>
  `<div style="display: block;">
    <table style="background-color: #f1f5f9; border-radius:1em; margin-top:1em; margin-bottom:1em;">
        <tr>
          <td style="text-align:center;">
            <p style="font-size:0.9em">Surveys</p>
            <h1>${insights.numLiveSurvey}</h1>
          </td>
          <td style="text-align:center;">
            <p style="font-size:0.9em">Displays</p>
            <h1>${insights.totalDisplays}</h1>
          </td>
          <td style="text-align:center;">
            <p style="font-size:0.9em">Responses</p>
            <h1>${insights.totalResponses}</h1>
          </td>
          <td style="text-align:center;">
            <p style="font-size:0.9em">Completed</p>
            <h1>${insights.totalCompletedResponses}</h1>
          </td>
          ${
            insights.totalDisplays !== 0
              ? `<td style="text-align:center;">
            <p style="font-size:0.9em">Completion %</p>
            <h1>${Math.round(insights.completionRate)}%</h1>
          </td>`
              : ""
          }
        </tr>
      </table>
  </div>
`;

function convertSurveyStatus(status) {
  const statusMap = {
    inProgress: "Live",
    paused: "Paused",
    completed: "Completed",
  };

  return statusMap[status] || status;
}

const getButtonLabel = (count) => {
  if (count === 1) {
    return "View Response";
  }
  return `View ${count > 2 ? count - 1 : "1"} more Response${count > 2 ? "s" : ""}`;
};

const notificationLiveSurveys = (surveys: Survey[], environmentId: string) => {
  if (!surveys.length) return ` `;

  return surveys
    .map((survey) => {
      const displayStatus = convertSurveyStatus(survey.status);
      const isLive = displayStatus === "Live";
      const noResponseLastWeek = isLive && survey.responses.length === 0;

      return `
        <div style="display: block; margin-top:3em;">
          <a href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
        survey.id
      }/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA" style="color:#1e293b;">
            <h2 style="text-decoration: underline; display:inline;">${survey.name}</h2>
          </a>
          <span style="display: inline; margin-left: 10px; background-color: ${
            isLive ? "#34D399" : "#cbd5e1"
          }; color: ${isLive ? "#F3F4F6" : "#1e293b"}; border-radius:99px; padding: 2px 8px; font-size:0.9em">
            ${displayStatus}
          </span>
          ${
            noResponseLastWeek
              ? "<p>No new response received this week 🕵️</p>"
              : createSurveyFields(survey.responses)
          }
          ${
            survey.responseCount >= 0
              ? `<a class="button" href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
                  survey.id
                }/responses?utm_source=weekly&utm_medium=email&utm_content=ViewResponsesCTA">
                ${noResponseLastWeek ? "View previous responses" : getButtonLabel(survey.responseCount)}
              </a>`
              : ""
          }
        <br/></div><br/>`;
    })
    .join("");
};

const createSurveyFields = (surveyResponses: SurveyResponse[]) => {
  let surveyFields = "";
  const responseCount = surveyResponses.length;

  surveyResponses.forEach((response, index) => {
    if (!response) {
      return;
    }

    for (const [headline, answer] of Object.entries(response)) {
      surveyFields += `
        <div style="margin-top:1em;">
          <p style="margin:0px;">${headline}</p>
          <p style="font-weight: bold; margin:0px;">${answer}</p>  
        </div>
      `;
    }

    // Add <hr/> only when there are 2 or more responses to display, and it's not the last response
    if (responseCount >= 2 && index < responseCount - 1) {
      surveyFields += "<hr/>";
    }
  });

  return surveyFields;
};

const notificationFooter = () => {
  return `
  <p style="margin-bottom:0px; padding-top:1em; font-weight:500">All the best,</p>
  <p style="margin-top:0px;">The Formbricks Team 🤍</p>
  <div style="margin-top:0.8em; background-color:#f1f5f9; border-radius:8px; padding:0.01em 1.6em; text-align:center; font-size:0.8em; line-height:1.2em;"><p><i>This is a Beta feature. If you experience any issues, please let us know by replying to this email 🙏</i></p></div>
 `;
};

const createReminderNotificationBody = (notificationData: NotificationResponse, webUrl) => {
  return `
    <p>We’d love to send you a Weekly Summary, but currently there are no surveys running for ${notificationData.productName}.</p>

    <p style="font-weight: bold; padding-top:1em;">Don’t let a week pass without learning about your users:</p>

    <a class="button" href="${webUrl}/environments/${notificationData.environmentId}/surveys?utm_source=weekly&utm_medium=email&utm_content=SetupANewSurveyCTA">Setup a new survey</a>
    
    <br/>
    <p style="padding-top:1em;">Need help finding the right survey for your product? Pick a 15-minute slot <a href="https://cal.com/johannes/15">in our CEOs calendar</a> or reply to this email :)</p>
     
   
    <p style="margin-bottom:0px; padding-top:1em; font-weight:500">All the best,</p>
    <p style="margin-top:0px;">The Formbricks Team</p>
   
    <div style="margin-top:0.8em; background-color:#f1f5f9; border-radius:99px; margin:1em; padding:0.01em 1.6em; text-align:center;"><p><i>This is a Beta feature. If you experience any issues, please let us know by replying to this email 🙏</i></p></div>
  `;
};

export const sendWeeklySummaryNotificationEmail = async (
  email: string,
  notificationData: NotificationResponse
) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: withEmailTemplate(`
        ${notificationHeader(notificationData.productName, startDate, endDate, startYear, endYear)}
        ${notificationInsight(notificationData.insights)}
        ${notificationLiveSurveys(notificationData.surveys, notificationData.environmentId)}
        ${notificationFooter()}
      `),
  });
};

export const sendNoLiveSurveyNotificationEmail = async (
  email: string,
  notificationData: NotificationResponse
) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: withEmailTemplate(`
        ${notificationHeader(notificationData.productName, startDate, endDate, startYear, endYear)}
        ${createReminderNotificationBody(notificationData, WEBAPP_URL)}
      `),
  });
};
