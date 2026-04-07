import { useEffect, useMemo, useState } from 'react';
import type {
  UserAccount,
  UserAccountCreateRequest,
  UserAccountUpdateRequest,
  WorkflowRole,
} from '../../shared/types';
import { WORKFLOW_ROLE_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

const WORKFLOW_ROLE_OPTIONS: WorkflowRole[] = ['prepare', 'confirm', 'review', 'approve'];

type PasswordDraftMap = Record<string, string>;

const emptyNewUser: UserAccountCreateRequest = {
  username: '',
  displayName: '',
  password: '',
  role: 'user',
  workflowRoles: ['prepare'],
  isActive: true,
};

function toggleRole(roles: WorkflowRole[], role: WorkflowRole) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
}

export function UserManagementPage() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState<UserAccountCreateRequest>(emptyNewUser);
  const [passwordDrafts, setPasswordDrafts] = useState<PasswordDraftMap>({});

  useEffect(() => {
    void api
      .getUserAccounts()
      .then((response) => {
        setItems(response.items);
        setError('');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载账号列表失败'))
      .finally(() => setLoading(false));
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => Number(right.role === 'admin') - Number(left.role === 'admin') || left.username.localeCompare(right.username)),
    [items],
  );

  const updateItem = (id: string, updater: (current: UserAccount) => UserAccount) => {
    setItems((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleCreate = async () => {
    if (!isAdmin) {
      return;
    }

    setSaving(true);
    try {
      const response = await api.createUserAccount(newUser);
      setItems(response.items);
      setNewUser(emptyNewUser);
      setMessage('新账号已创建。');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '新增账号失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (item: UserAccount) => {
    if (!isAdmin) {
      return;
    }

    setSaving(true);
    try {
      const payload: UserAccountUpdateRequest = {
        displayName: item.displayName,
        role: item.role,
        workflowRoles: item.workflowRoles,
      };
      const response = await api.updateUserAccount(item.id, payload);
      setItems(response.items);
      setMessage(`账号 ${item.displayName} 已保存。`);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存账号失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (item: UserAccount) => {
    const password = passwordDrafts[item.id]?.trim();
    if (!password) {
      setError('请先输入新密码。');
      return;
    }

    setSaving(true);
    try {
      await api.resetUserPassword(item.id, { password });
      setPasswordDrafts((current) => ({ ...current, [item.id]: '' }));
      setMessage(`已重置 ${item.displayName} 的密码。`);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重置密码失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: UserAccount) => {
    setSaving(true);
    try {
      const response = await api.setUserActive(item.id, { isActive: !item.isActive });
      setItems(response.items);
      setMessage(`${item.displayName} 已${item.isActive ? '停用' : '启用'}。`);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新账号状态失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Admin Console</p>
          <h2>账号管理</h2>
          <p>管理员可新增账号、分配流程角色、重置密码，并控制账号启用状态。</p>
        </div>
      </header>

      {!isAdmin ? <div className="state state--error">当前账号没有管理员权限。</div> : null}
      {message ? <div className="state">{message}</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      <section className="panel">
        <div className="panel__header">
          <h3>新增账号</h3>
          <span>密码至少 6 位，新增后即可登录。</span>
        </div>
        <div className="admin-user-create">
          <div className="form-grid form-grid--compact">
            <label className="field">
              <span>登录账号</span>
              <input
                value={newUser.username}
                disabled={!isAdmin}
                onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>显示名称</span>
              <input
                value={newUser.displayName}
                disabled={!isAdmin}
                onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>初始密码</span>
              <input
                type="password"
                value={newUser.password}
                disabled={!isAdmin}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>系统角色</span>
              <select
                value={newUser.role}
                disabled={!isAdmin}
                onChange={(event) =>
                  setNewUser((current) => ({ ...current, role: event.target.value as UserAccount['role'] }))
                }
              >
                <option value="user">业务用户</option>
                <option value="admin">管理员</option>
              </select>
            </label>
          </div>

          <div className="admin-role-selector">
            <span>流程角色</span>
            <div className="chip-grid chip-grid--toolbar">
              {WORKFLOW_ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`chip-button ${newUser.workflowRoles.includes(role) ? 'is-active' : ''}`}
                  disabled={!isAdmin}
                  onClick={() =>
                    setNewUser((current) => ({
                      ...current,
                      workflowRoles: toggleRole(current.workflowRoles, role),
                    }))
                  }
                >
                  {WORKFLOW_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          <label className="chip admin-switch">
            <input
              type="checkbox"
              checked={newUser.isActive}
              disabled={!isAdmin}
              onChange={(event) => setNewUser((current) => ({ ...current, isActive: event.target.checked }))}
            />
            启用账号
          </label>

          <div className="toolbar">
            <button type="button" className="button button--primary" disabled={saving || !isAdmin} onClick={() => void handleCreate()}>
              {saving ? '处理中...' : '新增账号'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>账号列表</h3>
          <span>{loading ? '加载中...' : `共 ${items.length} 个账号`}</span>
        </div>

        {loading ? <div className="state">正在读取账号列表...</div> : null}

        {!loading ? (
          <div className="admin-user-list">
            {sortedItems.map((item) => (
              <article key={item.id} className="admin-user-card">
                <div className="admin-user-card__header">
                  <div>
                    <strong>{item.displayName}</strong>
                    <p>
                      {item.username}
                      {item.id === user?.id ? ' · 当前账号' : ''}
                    </p>
                  </div>
                  <span className={`role-badge ${item.role === 'admin' ? 'role-badge--admin' : ''}`}>
                    {item.role === 'admin' ? '管理员' : item.isActive ? '启用' : '停用'}
                  </span>
                </div>

                <div className="form-grid form-grid--compact">
                  <label className="field">
                    <span>显示名称</span>
                    <input
                      value={item.displayName}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        updateItem(item.id, (current) => ({ ...current, displayName: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>系统角色</span>
                    <select
                      value={item.role}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        updateItem(item.id, (current) => ({
                          ...current,
                          role: event.target.value as UserAccount['role'],
                        }))
                      }
                    >
                      <option value="user">业务用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>创建时间</span>
                    <input value={new Date(item.createdAt).toLocaleString('zh-CN')} readOnly />
                  </label>
                  <label className="field">
                    <span>更新时间</span>
                    <input value={new Date(item.updatedAt).toLocaleString('zh-CN')} readOnly />
                  </label>
                </div>

                <div className="admin-role-selector">
                  <span>流程角色</span>
                  <div className="chip-grid chip-grid--toolbar">
                    {WORKFLOW_ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={`chip-button ${item.workflowRoles.includes(role) ? 'is-active' : ''}`}
                        disabled={!isAdmin}
                        onClick={() =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            workflowRoles: toggleRole(current.workflowRoles, role),
                          }))
                        }
                      >
                        {WORKFLOW_ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="admin-user-card__footer">
                  <label className="field admin-password-field">
                    <span>重置密码</span>
                    <input
                      type="password"
                      value={passwordDrafts[item.id] ?? ''}
                      placeholder="输入新密码"
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setPasswordDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </label>
                  <div className="toolbar">
                    <button type="button" className="button" disabled={saving || !isAdmin} onClick={() => void handleSaveRow(item)}>
                      保存账号
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={saving || !isAdmin}
                      onClick={() => void handleResetPassword(item)}
                    >
                      重置密码
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={saving || !isAdmin || item.id === user?.id}
                      onClick={() => void handleToggleActive(item)}
                    >
                      {item.isActive ? '停用账号' : '启用账号'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
