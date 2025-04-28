export function RecaptchaErrorComponent() {
  return (
    <div className="fb-flex fb-flex-col fb-bg-white fb-p-8 fb-text-center fb-items-center">
      <span className="fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900">
        We couldn't verify that you're human.
      </span>
      <p className="fb-max-w-lg fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
        Your response could not be submitted because it was flagged as automated activity. If you breath,
        please try again.
      </p>
    </div>
  );
}
