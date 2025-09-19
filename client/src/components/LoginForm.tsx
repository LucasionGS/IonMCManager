import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginForm.scss';

interface LoginFormProps {
  onToggleMode: () => void;
  isRegisterMode: boolean;
}

function LoginForm({ onToggleMode, isRegisterMode }: LoginFormProps) {
  const { login, register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let result;
      
      if (isRegisterMode) {
        result = await register(
          formData.username,
          formData.email,
          formData.password,
          formData.confirmPassword
        );
      } else {
        result = await login(formData.username, formData.password);
      }

      if (!result.success) {
        setError(result.message || 'An error occurred');
      }
      // Success is handled by the AuthContext and will redirect automatically
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Form submission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form">
      <div className="login-form__header">
        <h1 className="login-form__title">IonMC Server Manager</h1>
        <h2 className="login-form__subtitle">
          {isRegisterMode ? 'Create Account' : 'Welcome Back'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="login-form__form">
        {error && (
          <div className="login-form__error">
            {error}
          </div>
        )}

        <div className="login-form__field">
          <label htmlFor="username" className="login-form__label">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            value={formData.username}
            onChange={handleInputChange}
            className="login-form__input"
            placeholder="Enter your username"
            disabled={isLoading}
          />
        </div>

        {isRegisterMode && (
          <div className="login-form__field">
            <label htmlFor="email" className="login-form__label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="login-form__input"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
        )}

        <div className="login-form__field">
          <label htmlFor="password" className="login-form__label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleInputChange}
            className="login-form__input"
            placeholder="Enter your password"
            disabled={isLoading}
          />
        </div>

        {isRegisterMode && (
          <div className="login-form__field">
            <label htmlFor="confirmPassword" className="login-form__label">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="login-form__input"
              placeholder="Confirm your password"
              disabled={isLoading}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="login-form__submit"
        >
          {isLoading 
            ? (isRegisterMode ? 'Creating Account...' : 'Signing In...') 
            : (isRegisterMode ? 'Create Account' : 'Sign In')
          }
        </button>

        <div className="login-form__toggle">
          <span className="login-form__toggle-text">
            {isRegisterMode 
              ? 'Already have an account?' 
              : "Don't have an account?"
            }
          </span>
          <button
            type="button"
            onClick={onToggleMode}
            className="login-form__toggle-button"
            disabled={isLoading}
          >
            {isRegisterMode ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginForm;