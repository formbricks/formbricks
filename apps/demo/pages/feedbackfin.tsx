import Script from "next/script";

export default function FeedbackFin() {
  return (
    <>
      <Script src="https://unpkg.com/feedbackfin@^1" defer />
      <Script id="feedbackfin-setup">{`window.feedbackfin = { config: {}, ...window.feedbackfin };window.feedbackfin.config.url = "https://typedwebhook.tools/webhook/129ac3a2-a93c-41c1-aa99-9713ba2bc393";window.feedbackfin.config.user = { name: "Pete", email: "mail@example.com" };`}</Script>
      {/* <button onClick={(event) => window.feedbackfin.open(event)}>Feedback</button> */}
    </>
  );
}
