import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('请输入登录账号。');
      return;
    }

    if (!password.trim()) {
      setError('请输入登录密码。');
      return;
    }

    setSubmitting(true);

    try {
      await login({ username: trimmedUsername, password });
      setError('');
      navigate(from, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="Production Process Card Management System" />
          <div className="login-brand__copy">
            <h1>生产工艺卡管理系统</h1>
            <p className="page__eyebrow">Production Process Card Management</p>
          </div>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>账号</span>
            <input
              value={username}
              autoComplete="username"
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) {
                  setError('');
                }
              }}
              placeholder="请输入账号"
            />
          </label>

          <label className="field">
            <span>密码</span>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) {
                    setError('');
                  }
                }}
                placeholder="请输入密码"
              />
              <button
                type="button"
                className="password-input__toggle"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                title={showPassword ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 4.5 19.5 21"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.6 6.2A10.9 10.9 0 0 1 12 6c5.4 0 9.4 4.6 10 6-.3.7-1.5 2.6-3.4 4.1M14.8 14.9A3.5 3.5 0 0 1 9 12.2M6.3 9.3A15.2 15.2 0 0 0 2 12c.6 1.4 4.6 6 10 6 1.2 0 2.4-.2 3.4-.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error ? <div className="state state--error">{error}</div> : null}

          <button type="submit" className="button button--primary login-submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录系统'}
          </button>
        </form>
      </div>
    </div>
  );
}
