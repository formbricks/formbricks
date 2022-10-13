interface Props {
  children?: React.ReactNode;
}

const LimitedWidth: React.FC<Props> = ({ children }) => {
  return <main className="mx-auto h-full w-full max-w-5xl">{children}</main>;
};

export default LimitedWidth;
