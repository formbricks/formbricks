import { signIn } from 'next-auth/react';
import { FaGithub } from 'react-icons/fa';
import LoginButton from './LoginButton';

const GithubLoginButton = ({ noMx = false }: { noMx?: boolean }) => {
  const handleLogin = async () => {
    await signIn('github', {
      redirect: true,
      callbackUrl: '/', // redirect after login to /
    });
  };

  return (
    <LoginButton
      icon={FaGithub}
      text="Login With Github"
      onClick={handleLogin}
      className={`${noMx ? '' : 'mx-2'} bg-black-700 text-white my-2`}
    />
  );
};

export default GithubLoginButton;
