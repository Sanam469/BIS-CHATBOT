'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './styles.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userEmail = localStorage.getItem('userEmail');
    if (token && userEmail) {
      router.push('/');
    }
  }, [router]);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', email);
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => router.push('/'), 800);
      } else {
        showToast(data.error || 'Login failed. Please try again.', 'error');
      }
    } catch (error) {
      showToast('Error connecting to server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      showToast('Please fill in email and password to register.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (response.ok) {
        showToast('Account created! Please sign in.', 'success');
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (error) {
      showToast('Error connecting to server.', 'error');
    }
  };

  return (
    <div className="login-wrapper">
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      <div className="login-container">
        <div className="brand">
          <div className="brand-logo">
            <span className="letter-b">B</span><span className="letter-i">I</span><span className="letter-s">S</span>
          </div>
          <h1>Welcome back</h1>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" required autoComplete="email" />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" />
          </div>
          <button type="submit" className={`login-btn ${isLoading ? 'btn-loading' : ''}`} disabled={isLoading}>
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
            <span className="arrow">→</span>
          </button>

          <div className="divider">
            <span>Or don't have an account?</span>
          </div>

          <button type="button" className="google-btn" onClick={handleSignUp}>
            <span>Sign Up</span>
            <span className="arrow">→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
