const ShareResultsNotFound = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold text-slate-800">404</h1>
      <p className="mt-4 text-lg text-slate-600">
        This share link has expired, been revoked, or does not exist.
      </p>
      <p className="mt-2 text-sm text-slate-400">
        If you believe this is an error, please contact the person who shared this link with you.
      </p>
    </div>
  );
};

export default ShareResultsNotFound;
