/** Title and one line of context at the top of an auth card. */
export const AuthHeading = ({
  title,
  description,
}: Readonly<{ title: React.ReactNode; description?: React.ReactNode }>) => (
  <div>
    <h1 className="text-2xl leading-8 font-bold text-balance text-slate-800">{title}</h1>
    {description ? <p className="mt-1 text-pretty text-slate-500">{description}</p> : null}
  </div>
);
