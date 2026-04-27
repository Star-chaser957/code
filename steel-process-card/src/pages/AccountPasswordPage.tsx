import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

export function AccountPasswordPage() {
  const { logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearNotice = () => {
    if (message) {
      setMessage('');
    }
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      setError('请输入当前密码。');
      setMessage('');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码至少需要 6 位。');
      setMessage('');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致。');
      setMessage('');
      return;
    }

    if (currentPassword === newPassword) {
      setError('新密码不能和当前密码相同。');
      setMessage('');
      return;
    }

    setSaving(true);
    try {
      await api.changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码已修改。');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '修改密码失败，请稍后再试。');
      setMessage('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Account Security</p>
          <h2>个人账号管理</h2>
          <p>{user?.displayName ?? user?.username}</p>
        </div>
        <button type="button" className="button button--ghost" onClick={() => void logout()}>
          退出登录
        </button>
      </header>

      {message ? <div className="state">{message}</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      <section className="panel account-password-panel">
        <div className="panel__header">
          <h3>修改登录密码</h3>
          <span>为了避免误触，退出登录已移动到本页面右上角。</span>
        </div>

        <form className="account-password-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>当前密码</span>
            <input
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => {
                clearNotice();
                setCurrentPassword(event.target.value);
              }}
            />
          </label>

          <label className="field">
            <span>新密码</span>
            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => {
                clearNotice();
                setNewPassword(event.target.value);
              }}
            />
          </label>

          <label className="field">
            <span>确认新密码</span>
            <input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => {
                clearNotice();
                setConfirmPassword(event.target.value);
              }}
            />
          </label>

          <div className="toolbar">
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? '处理中...' : '确认修改'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
