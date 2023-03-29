import Link from "next/link";

interface CardProps {
  onClick?: () => void;
  href?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export type { CardProps };

export const Card: React.FC<CardProps> = ({
  href,
  onClick,
  title,
  description,
  icon,
  className = "",
  children,
}) =>
  href ? (
    <Link
      href={href}
      className={`hover:ring-brand-dark cursor-pointer rounded-lg bg-white p-8 text-left shadow-sm transition-all duration-150 ease-in-out hover:ring-1 ${className}`}>
      <div className="float-right">{children}</div>
      {icon && <div className="mb-6 h-8 w-8">{icon}</div>}
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
    </Link>
  ) : (
    <button
      onClick={onClick}
      className={`hover:ring-brand-dark cursor-pointer rounded-lg bg-white p-8 text-left shadow-sm transition-all duration-150 ease-in-out hover:ring-1 ${className}`}>
      <div className="float-right">{children}</div>
      {icon && <div className="mb-6 h-8 w-8">{icon}</div>}
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
    </button>
  );
