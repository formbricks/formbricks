import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import LoginButton from './LoginButton';

const GoogleLoginButton = ({ noMx = false }: { noMx?: boolean }) => {
  const handleLogin = async () => {
    await signIn('google', {
      redirect: true,
      callbackUrl: '/', // redirect after login to /
    });
  };

  return (
    <LoginButton
      icon={FcGoogle}
      onClick={handleLogin}
      text="Login With Google"
      className={`${noMx ? '' : 'mx-2'} bg-white text-black my-2`}
    />
  );
};

export default GoogleLoginButton;
