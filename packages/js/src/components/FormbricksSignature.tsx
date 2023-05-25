import { h } from "preact";

export default function FormbricksSignature() {
  return (
    <a
      href="https://formbricks.com?utm_source=survey_branding"
      target="_blank"
      className="mt-3 flex justify-center">
      <p className=" text-xs text-slate-400">
        Powered by{" "}
        <b>
          <span className="text-slate-6500 hover:text-slate-700">Formbricks</span>
        </b>
      </p>
    </a>
  );
}
