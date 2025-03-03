interface SimpleLayoutProps {
  children: React.ReactNode;
}

export const SimpleLayout = ({ children }: SimpleLayoutProps) => {
  return (
    <div className="max-w-8xl flex">
      <div className="w-full">{children}</div>
    </div>
  );
};
