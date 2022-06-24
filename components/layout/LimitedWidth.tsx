interface Props {
  children?: React.ReactNode;
}

const LimitedWidth: React.FC<Props> = ({ children }) => {
  return <main className="h-full mx-auto max-w-7xl">{children}</main>;
};

export default LimitedWidth;
