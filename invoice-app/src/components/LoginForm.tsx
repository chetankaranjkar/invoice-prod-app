import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, BarChart3 } from 'lucide-react';
import { api } from '../services/agent';
import type { LoginDto } from '../types';
import { isValidEmail, sanitizeString } from '../utils/validation';
import { getApiErrorMessage } from '../utils/helpers';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState<LoginDto>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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

    const sanitizedData = {
      Email: sanitizeString(formData.email).toLowerCase().trim(),
      Password: formData.password.trim(),
    };

    try {
      const response = await api.auth.login(sanitizedData);
      localStorage.setItem('authToken', response.data.token);
      const userData = {
        id: response.data.userId,
        email: response.data.email,
        name: response.data.name,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error details:', err);
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitizedValue = name === 'email' ? sanitizeString(value) : value;
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left side — brand panel */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
        {/* Decorative geometric pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/3 -right-16 w-80 h-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-[28rem] h-[28rem] rounded-full bg-indigo-300/20 blur-3xl" />
        </div>
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center font-bold text-lg">
              IM
            </div>
            <div>
              <div className="font-semibold text-lg leading-tight">Invoice Master</div>
              <div className="text-xs text-white/70">Billing & Finance Platform</div>
            </div>
          </div>

          {/* Centerpiece */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
                Effortless invoicing,<br />
                <span className="text-fuchsia-200">delightful clarity.</span>
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-md leading-relaxed">
                Manage customers, invoices, payments, and recurring billing — all from one polished workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-w-md">
              <Feature icon={<BarChart3 className="h-4 w-4" />} title="Real-time financial dashboards" />
              <Feature icon={<Sparkles className="h-4 w-4" />} title="GST-ready invoices & flexible layouts" />
              <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Role-based access & audit logs" />
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-white/60">© 2025 Leapnext. All rights reserved.</p>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              IM
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold text-slate-900">Invoice Master</div>
              <div className="text-xs text-slate-500">Billing & Finance Platform</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your account to continue.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="ui-label">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="ui-input h-11 pl-10"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="ui-input h-11 pl-10 pr-10"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 select-none cursor-pointer pt-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600">Keep me signed in</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-sm shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Protected by enterprise-grade security & audit logging.
          </p>
        </div>
      </div>
    </div>
  );
};

const Feature: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-3">
    <span className="h-7 w-7 rounded-md bg-white/15 border border-white/20 flex items-center justify-center text-white">
      {icon}
    </span>
    <span className="text-sm text-white/90">{title}</span>
  </div>
);
