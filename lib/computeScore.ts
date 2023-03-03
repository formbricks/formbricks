export function computeScore(
  event,
  pagesFormated: {},
  submissions: {},
) {
  
     

      // if (pagesFormated[event.data["pageName"]]) {
      //   const pageTitle = pagesFormated[event.data["pageName"]].title;

      //   const candidateResponse = {};
      //   const length = event.data["submission"]
      //     ? Object.keys(event.data["submission"]).length
      //     : 0;
      //   let stepQuestionsHasResponseField = pageTitle
      //     .toLowerCase()
      //     .includes("finance");
      //   let goodAnswer = 0;
      //   if (event.data["submission"]) {
      //     Object.keys(event.data["submission"]).map((key) => {
      //       const submission = {};
      //       const response = event.data["submission"][key];
      //       goodAnswer =
      //         pagesFormated[event.data["pageName"]].blocks[key]?.data
      //           ?.response === response
      //           ? goodAnswer + 1
      //           : goodAnswer;

      //       const question =
      //         pagesFormated[event.data["pageName"]].blocks[key]?.data.label;
      //       submission[question] = response;
      //       candidateResponse[question] = response;
      //     });
      //     event.data["submission"]["score"] = goodAnswer / length;
      //   }
      //   if (!stepQuestionsHasResponseField) {
      //     submissions[pageTitle] = (goodAnswer / length) * 100;
      //   } else {
      //     if (
      //       Object.values(candidateResponse)
      //         [Object.values(candidateResponse).length - 1]?.split(" ")[1]
      //         ?.replace("*", "")
      //         ?.includes("pr")
      //     ) {
      //       submissions[pageTitle] = "p";
      //     } else {
      //       submissions[pageTitle] = parseInt(
      //         Object.values(candidateResponse)
      //           [Object.values(candidateResponse).length - 1]?.split(" ")[1]
      //           ?.replace("*", ""),
      //         10
      //       );
      //     }
      //   }
      // }
}
