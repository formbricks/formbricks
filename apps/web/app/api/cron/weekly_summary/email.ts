import { sendEmail } from "@/lib/email";
import { withEmailTemplate } from "@/lib/email-template";
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
        <p style="text-align: right; margin: 0; font-weight: bold;">Weekly Report for ${productName}</p>
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
    <table style="background-color: #f1f5f9;">
        <tr>
          <td>
            <p>Live surverys</p>
            <h1>${insights.numLiveSurvey}</h1>
          </td>
          <td>
            <p>Total Displays</p>
            <h1>${insights.totalDisplays}</h1>
          </td>
          <td>
            <p>Total Responses</p>
            <h1>${insights.totalResponses}</h1>
          </td>
          <td>
            <p>Completed</p>
            <h1>${insights.totalCompletedResponses}</h1>
          </td>
          <td>
            <p>Completion %</p>
            <h1>${insights.completionRate.toFixed(2)}%</h1>
          </td>
        </tr>
      </table>
  </div>
`;

const notificationLiveSurveys = (surverys: Survey[], environmentId: string) => {
  if (surverys.length == 0) {
    return `

    `;
  } else {
    let liveSurveys = `
      <div style="display: block;">
          <p>Review surverys</p>
        </div>
    `;

    for (const survey of surverys) {
      liveSurveys += `

      <div style="display: block;">
        <h2 style="text-decoration: underline;">${survey.name}</h2>
        ${createSurveyFields(survey.responses)}
        <a class="button" href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
        survey.id
      }/responses" style="background: black;">View all Responses</a><br/>
      </div>

      <br/><br/>
      `;
    }
    return liveSurveys;
  }
};

const createSurveyFields = (surveryResponse: SurveyResponse[]) => {
  let surveyFields = "";
  for (const response of surveryResponse) {
    surveyFields += `
      <p>${response.headline}</p>
      <p style="font-weight: bold;">${response.answer}</p>
    `;
  }
  return surveyFields;
};

const createReminderNotificationBody = (notificationData: NotificationResponse, webUrl) => {
  return `
    <p>We’d love to send you a Weekly Summary, but you currently there are no surveys running for ${notificationData.productName}.</p>

    <p style="font-weight: bold;">Don’t let a week pass without learning about your users.</p>

    <a class="button" href="${webUrl}/environments/${notificationData.environmentId}/surveys" style="background: black;">Setup a new survey</a>
    
    <br/>
    <p>Need help finding the right survey for your product?</p>

    <p>Pick a 15 minute slot with <a href="https://cal.com/johannes+matti/30">in our CEOs calendar</a> or reply to this email :)</p>
      
    <p>All the best</p>
    <p>The Formbricks Team</p>
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
