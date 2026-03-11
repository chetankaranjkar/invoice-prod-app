import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { api } from '../services/agent';
import type { LoginDto } from '../types';
import { isValidEmail, sanitizeString } from '../utils/validation';
import { getApiErrorMessage } from '../utils/helpers';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

// Proper function component
export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState<LoginDto>({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate inputs
    if (!isValidEmail(formData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Sanitize inputs and convert to PascalCase for backend (C# expects PascalCase)
    const sanitizedData = {
      Email: sanitizeString(formData.email).toLowerCase().trim(),
      Password: formData.password.trim(), // Don't sanitize password, just trim
    };

    try {
      const response = await api.auth.login(sanitizedData);
      localStorage.setItem('authToken', response.data.token);
      // Store minimal user data (no sensitive info)
      const userData = {
        id: response.data.userId,
        email: response.data.email,
        name: response.data.name
      };
      localStorage.setItem('user', JSON.stringify(userData));
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error details:', err);
      
      // Better error handling
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Sanitize email input
    const sanitizedValue = name === 'email' ? sanitizeString(value) : value;
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
  };

  return (
    <div className="min-h-screen flex bg-white relative">
      {/* Copyright - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-20">
        <p className="text-xs text-gray-400">
          Copyright 2025 Leapnext, All Rights Reserved.
        </p>
      </div>

      {/* Left Side - Decorative Gradient Blobs */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient Blob Shapes */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-pink-400 via-purple-500 to-purple-600 rounded-full blur-3xl opacity-60 -translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-pink-500 via-rose-500 to-orange-400 rounded-full blur-3xl opacity-50 -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 rounded-full blur-3xl opacity-40"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-tr from-purple-400 via-pink-500 to-rose-400 rounded-full blur-3xl opacity-45"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 font-hostania">User Login</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none relative block w-full pl-12 pr-4 py-3 bg-gray-100 border-0 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-colors"
                  placeholder="Username"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none relative block w-full pl-12 pr-4 py-3 bg-gray-100 border-0 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-colors"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg text-white font-medium text-sm uppercase tracking-wide bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 hover:from-orange-500 hover:via-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
              Forgot Username Password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};