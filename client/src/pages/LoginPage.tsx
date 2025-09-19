import { useState } from 'react';
import LoginForm from '../components/LoginForm';

function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleToggleMode = () => {
    setIsRegisterMode(prev => !prev);
  };

  return (
    <LoginForm 
      onToggleMode={handleToggleMode} 
      isRegisterMode={isRegisterMode} 
    />
  );
}

export default LoginPage;