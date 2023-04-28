export const handleFeedbackSubmit = async (YesNo, pageUrl) => {
  const response_data = {
    data: {
      isHelpful: YesNo,
      pageUrl: pageUrl,
    },
  };

  const payload = {
    response: response_data,
    surveyId: process.env.NEXT_PUBLIC_FORMBRICKS_COM_DOCS_FEEDBACK_SURVEY_ID,
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_FORMBRICKS_COM_API_HOST}/api/v1/client/environments/${process.env.NEXT_PUBLIC_FORMBRICKS_COM_ENVIRONMENT_ID}/responses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      const responseJson = await res.json();
      return responseJson.id; // Return the response ID
    } else {
      console.error("Error submitting form");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
  }
};

export const updateFeedback = async (freeText, responseId) => {
  if (!responseId) {
    console.error("No response ID available");
    return;
  }

  const payload = {
    response: {
      data: {
        additionalInfo: freeText,
      },
      finished: true,
    },
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_FORMBRICKS_COM_API_HOST}/api/v1/client/environments/${process.env.NEXT_PUBLIC_FORMBRICKS_COM_ENVIRONMENT_ID}/responses/${responseId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      console.error("Error updating response");
    }
  } catch (error) {
    console.error("Error updating response:", error);
  }
};
