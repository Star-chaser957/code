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
    setSubmitting(true);

    try {
      await login({
        username,
        password,
      });
      setError('');
      navigate(from, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="钢棒生产工艺卡系统" />
          <div>
            <p className="page__eyebrow">Steel Process Card</p>
            <h1>钢棒/型钢生产工艺卡系统</h1>
            <p>登录后即可录入、查询、打印工艺卡。管理员账号可维护系统字典。</p>
          </div>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>账号</span>
            <input
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <div className="state state--error">{error}</div> : null}

          <button type="submit" className="button button--primary login-submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录系统'}
          </button>
        </form>

        <div className="login-hint">
          <strong>默认账号</strong>
          <p>管理员：admin / admin123</p>
          <p>普通用户：operator / operator123</p>
        </div>
      </div>
    </div>
  );
}
