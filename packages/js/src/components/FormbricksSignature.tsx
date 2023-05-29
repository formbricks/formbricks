import { h } from "preact";

export default function FormbricksSignature() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      className="fb-mb-5 fb-mt-2 fb-flex fb-justify-center">
      <p className="fb-text-xs fb-text-slate-400">
        Powered by{" "}
        <b>
          <span className="fb-text-slate-500 fb-hover:text-slate-700">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
