import { renderSurvey, TResponse } from "@formbricks/surveys";

renderSurvey({
  id: "formbricks-survey",
  brandColor: "#000000",
  onResponse: (response: TResponse) => {
    console.log(response);
  },
  surveyId: "clkmwo2we000319lx36i6ezjy",
});

// HTML
/* <body>
  <div id="formbricks-survey"></div>
</body>; */
