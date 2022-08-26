import { FcGoogle } from 'react-icons/fc';
import LoginButton from './LoginButton';

const GoogleLoginButton = ({ noMx = false }: { noMx?: boolean }) => {
  return (
    <LoginButton
      icon={FcGoogle}
      text="Login with Google"
      className={`${noMx ? '' : 'mx-2'} bg-white text-black my-2`}
    />
  );
};

export default GoogleLoginButton;
