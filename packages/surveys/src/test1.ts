import { renderSurvey } from "@formbricks/surveys";

const survey = {
  id: "clkqxmrsb0000qhb65bvnl3jo",
  createdAt: "2023-07-31T13:55:03.083Z",
  updatedAt: "2023-08-02T10:32:48.551Z",
  name: "Onboarding Segmentation",
  type: "web",
  environmentId: "clkmwo2we000319lx36i6ezjy",
  status: "inProgress",
  questions: [
    {
      id: "tjfrd7vl5tba9guvdycl3o6j",
      type: "multipleChoiceSingle",
      choices: [
        {
          id: "ltyyycfznyx80irvq9ibajee",
          label: "Founder",
        },
        {
          id: "dn4i1iy0084xvdiw66wv1aw8",
          label: "Executive",
        },
        {
          id: "s97uhkft8rgsysig65okiutj",
          label: "Product Manager",
        },
        {
          id: "mj6ioso3qa6dg76890vnih2r",
          label: "Product Owner",
        },
        {
          id: "adzlxloi315gsq3yb0myp3zl",
          label: "Software Engineer",
        },
      ],
      headline: "What is your role?",
      required: true,
      subheader: "Please select one of the following options:",
      shuffleOption: "none",
    },
    {
      id: "egbcs0bd69g5eda9k40vbpp3",
      type: "multipleChoiceSingle",
      choices: [
        {
          id: "yyfh53makxs4j8g80ivt730q",
          label: "only me",
        },
        {
          id: "hi3oq0xoqzb8vb9o0iu6jb2k",
          label: "1-5 employees",
        },
        {
          id: "v5sgmfzv7emzv53yl5ccn1wb",
          label: "6-10 employees",
        },
        {
          id: "h3itbp586acy0howt3nt6m9u",
          label: "11-100 employees",
        },
        {
          id: "yvxxp5j8o73bmki57sgyujm5",
          label: "over 100 employees",
        },
      ],
      headline: "What's your company size?",
      required: true,
      subheader: "Please select one of the following options:",
      shuffleOption: "none",
    },
    {
      id: "ahs3ua7mxa8j9zu0l1rxggdb",
      type: "multipleChoiceSingle",
      choices: [
        {
          id: "r49lw7zr68guex26fnz76pol",
          label: "Recommendation",
        },
        {
          id: "xzp1f0v8gapisr74gzej6ptw",
          label: "Social Media",
        },
        {
          id: "msg5sac4xxilgxu7zkm299gu",
          label: "Ads",
        },
        {
          id: "cj3dyxf2x4mdoi6os8l974vn",
          label: "Google Search",
        },
        {
          id: "og10iassb2eai911092ro3d8",
          label: "In a Podcast",
        },
      ],
      headline: "How did you hear about us first?",
      required: true,
      subheader: "Please select one of the following options:",
      shuffleOption: "none",
    },
  ],
  thankYouCard: {
    enabled: true,
    headline: "Thank you!",
    subheader: "We appreciate your feedback.",
  },
  displayOption: "respondMultiple",
  recontactDays: 0,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  autoComplete: null,
  redirectUrl: null,
  triggers: [
    {
      id: "clkqxnq4h0006qhb6w1qxddy4",
      createdAt: "2023-07-31T13:55:47.586Z",
      updatedAt: "2023-07-31T13:55:47.586Z",
      environmentId: "clkmwo2we000319lx36i6ezjy",
      name: "Code Action",
      description: null,
      type: "code",
      noCodeConfig: null,
    },
  ],
  attributeFilters: [],
  displays: [
    {
      createdAt: "2023-08-02T14:57:22.837Z",
    },
  ],
};

const survey = { id: "clkqxmrsb0000qhb65bvnl3jo", ... };
renderSurvey({
    containerId: "formbricks-survey",
    brandColor: "#000000",
    formbricksSignature: true,
    onResponse: (response) => {
      console.log(response);
    },
    survey,
}); 

registerSurveyContainer({
    id: "dashboard-survey",
    action: "onDashboard"
});


// HTML
/* <body>
  <div id="formbricks-survey"></div>
</body>; */
