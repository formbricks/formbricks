export const handleFeedbackSubmit = async (YesNo, pageUrl) => {
  const response_data = {
    data: {
      isHelpful: YesNo,
      pageUrl: pageUrl,
    },
  };

  const payload = {
    response: response_data,
    surveyId: "clgwcyg7n000qof0g6y92ct2v",
  };

  try {
    const res = await fetch(
      "https://app.formbricks.com/api/v1/client/environments/clgwcwp50000spf0hamsb0jo8/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      console.log("Form submitted successfully");
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
      `https://app.formbricks.com/api/v1/client/environments/clgwcwp50000spf0hamsb0jo8/responses/${responseId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      console.log("Response updated successfully.");
    } else {
      console.error("Error updating response");
    }
  } catch (error) {
    console.error("Error updating response:", error);
  }
};
