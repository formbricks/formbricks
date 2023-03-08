import Link from "next/link";

interface CardProps {
  href: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ href, title, description, icon, className = "" }) => (
  <Link
    href={href}
    className={`hover:ring-brand-dark cursor-pointer rounded-lg bg-white p-8 text-left shadow-sm transition-all duration-150 ease-in-out hover:ring-1 ${className}`}>
    {icon && <div className="mb-6 h-8 w-8">{icon}</div>}
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500">{description}</p>
  </Link>
);

export default Card;
