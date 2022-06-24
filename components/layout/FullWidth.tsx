interface Props {
  children?: React.ReactNode;
}

const FullWidth: React.FC<Props> = ({ children }) => {
  return <main className="w-full h-full">{children}</main>;
};

export default FullWidth;
