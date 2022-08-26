import { IconType } from 'react-icons';

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
    <button onClick={onClick} className="grow">
      <div
        className={`flex gap-4 text-sm items-center p-3 rounded-lg align-middle ${className}`}
      >
        {Icon && <Icon size={25} />} {text}
      </div>
    </button>
  );
};

export default LoginButton;
