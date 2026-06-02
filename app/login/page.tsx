'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, registerUser } from '../actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError('');

    try {
      const result = isLogin 
        ? await loginUser(formData)
        : await registerUser(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.success && result.redirectTo) {
        // Force the router directly to the correct page, bypassing the root cache!
        router.push(result.redirectTo);
        router.refresh(); 
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isLogin 
              ? 'Enter your credentials to access your dashboard.' 
              : 'Sign up for a private, zero-tracking fitness profile.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-500/10 p-3 text-sm border border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. iron_lifter_99"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Min. 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 transition-colors"
          >
            {isLoading 
              ? 'Processing...' 
              : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {isLogin ? 'Sign up here' : 'Log in instead'}
          </button>
        </div>
      </div>
    </main>
  );
}