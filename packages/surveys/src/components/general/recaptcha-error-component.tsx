export function RecaptchaErrorComponent() {
  return (
    <div className="fb-flex fb-flex-col fb-bg-white fb-p-4">
      <span className="fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900">
        {" "}
        We couldn't verify that you're a human.
      </span>
      <p className="fb-max-w-md fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
        This may happen if your activity looks automated or if something went wrong during verification.
      </p>
      <p className="fb-max-w-md fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
        Please refresh the page and try again. If the issue persists, ensure that cookies and JavaScript are
        enabled in your browser.
      </p>
    </div>
  );
}
