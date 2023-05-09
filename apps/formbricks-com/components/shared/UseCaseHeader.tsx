interface UseCaseHeaderProps {
  title: string;

  difficulty: string;
  setupMinutes: string;
}

export default function UseCaseHeader({ title, difficulty, setupMinutes }: UseCaseHeaderProps) {
  return (
    <div>
      <div className="mb-4 flex items-center space-x-2">
        <h1 className="pr-4 text-3xl font-semibold text-slate-800">{title}</h1>
        <div className="flex items-center justify-center rounded-full bg-indigo-200 px-4 py-1 text-sm text-indigo-700">
          {difficulty}
        </div>
        <div className="flex items-center justify-center rounded-full bg-slate-300 px-4 py-1 text-sm text-slate-700">
          {setupMinutes} minutes
        </div>
      </div>
    </div>
  );
}
