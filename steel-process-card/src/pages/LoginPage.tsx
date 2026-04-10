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
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
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
          <img src="/logo.png" alt="Production Process Card System" />
          <div className="login-brand__copy">
            <h1>生产工艺卡系统</h1>
            <p className="page__eyebrow">Production Process Card</p>
          </div>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>账号</span>
            <input
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入账号"
            />
          </label>

          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
            />
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
