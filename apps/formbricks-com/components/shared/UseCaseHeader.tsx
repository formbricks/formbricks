interface UseCaseHeaderProps {
  title: string;
  description: string;
  difficulty: string;
  setupMinutes: string;
}

export default function UseCaseHeader({ title, description, difficulty, setupMinutes }: UseCaseHeaderProps) {
  return (
    <div>
      <div className="mb-4 flex items-center space-x-2">
        <h1 className="pr-4 text-5xl font-semibold text-slate-800">{title}</h1>
        <div className="text-md flex items-center justify-center rounded-full bg-indigo-200 px-4 py-1 text-indigo-700">
          {difficulty}
        </div>
        <div className="text-md flex items-center justify-center rounded-full bg-slate-300 px-4 py-1 text-slate-700">
          {setupMinutes} minutes
        </div>
      </div>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}
