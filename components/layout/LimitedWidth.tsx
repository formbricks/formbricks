interface Props {
  children?: React.ReactNode;
}

const LimitedWidth: React.FC<Props> = ({ children }) => {
  return <main className="w-full h-full max-w-5xl mx-auto">{children}</main>;
};

export default LimitedWidth;
