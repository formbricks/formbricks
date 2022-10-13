interface Props {
  children?: React.ReactNode;
}

const FullWidth: React.FC<Props> = ({ children }) => {
  return <main className="h-full w-full">{children}</main>;
};

export default FullWidth;
