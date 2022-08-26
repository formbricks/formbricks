import { IconType } from 'react-icons';
import StandardButton from '../StandardButton';

type Props = {
  text?: string;
  onClick?: () => void;
  icon?: IconType;
  className?: string;
};

const LoginButton = ({
  text,
  onClick,
  icon: Icon,
  className = 'bg-black-700 text-white',
}: Props) => {
  return (
    <StandardButton
      onClick={onClick}
      className="grow relative flex items-center gap-3 bg-black-700 justify-center w-full pl-2 pr-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm"
      icon
    >
      <div className="grow-0 absolute left-2">{Icon && <Icon size={25} />}</div>
      {/* // className={`flex  text-sm items-center p-3 rounded-lg align-middle ${className}`} */}
      <p className="text-center m-auto w-100">{text}</p>
    </StandardButton>
  );
};

export default LoginButton;
