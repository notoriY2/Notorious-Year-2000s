import React, { useState } from 'react';
import { X, Mail, Lock, User, Facebook, Instagram, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
  onSignInWithProvider: (provider: 'google' | 'facebook' | 'instagram') => Promise<void>;
  isLoading: boolean;
  contextMessage?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6; // matches Supabase's default minimum

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  onSignUp,
  onSignInWithProvider,
  isLoading,
  contextMessage,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setFieldErrors({});
    setFormError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (isSignUp && name.trim().length < 2) {
      errors.name = 'Please enter your full name.';
    }

    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (isSignUp && confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Turn Supabase/GoTrue error messages into something a user can act on,
  // since the raw messages ("Email address ... is invalid", "User already
  // registered", etc.) are accurate but worth normalizing for tone.
  const describeAuthError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);

    if (/already registered/i.test(message)) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (/invalid login credentials/i.test(message)) {
      return 'Incorrect email or password. Please try again.';
    }
    if (/email.*invalid/i.test(message)) {
      return 'That email address was rejected by the server. Double-check it, or try a different address.';
    }
    if (/password/i.test(message) && /short|length|weak/i.test(message)) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (/network/i.test(message)) {
      return 'Network error — please check your connection and try again.';
    }
    return message || 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;

    try {
      if (isSignUp) {
        await onSignUp(email.trim(), password, name.trim());
      } else {
        await onSignIn(email.trim(), password);
      }
      handleClose();
    } catch (error) {
      console.error('Auth error:', error);
      setFormError(describeAuthError(error));
    }
  };

  const handleProviderClick = async (provider: 'google' | 'facebook' | 'instagram') => {
    setFormError(null);
    try {
      await onSignInWithProvider(provider);
    } catch (error) {
      console.error('Provider auth error:', error);
      setFormError(describeAuthError(error));
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none transition-colors ${
      hasError
        ? 'border-red-400 focus:border-red-500'
        : 'border-gray-300 focus:border-black'
    }`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[57] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            className="text-xl font-light tracking-wide"
            style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif' }}
          >
            {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {contextMessage && (
          <p className="px-6 pt-4 text-sm text-gray-500">{contextMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {formError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {isSignUp && (
            <div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass(fieldErrors.name)}
                />
              </div>
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>
          )}

          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass(fieldErrors.email)}
                autoComplete="email"
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass(fieldErrors.password)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {isSignUp && (
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass(fieldErrors.confirmPassword)}
                  autoComplete="new-password"
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleProviderClick('google')}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm font-medium">Continue with Google</span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-3 rounded-lg font-light tracking-wide hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
            style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif' }}
          >
            {isLoading ? 'LOADING...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFieldErrors({});
                setFormError(null);
              }}
              className="text-gray-600 hover:text-black transition-colors text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;