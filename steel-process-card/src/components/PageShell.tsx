import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { WORKFLOW_ROLE_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

export function PageShell() {
  const { isAdmin, logout, user } = useAuth();
  const [todoCount, setTodoCount] = useState(0);
  const workflowRoleText = user?.workflowRoles.length
    ? user.workflowRoles.map((roleCode) => WORKFLOW_ROLE_LABELS[roleCode]).join(' / ')
    : '查看';

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const response = await api.getNotificationOverview();
        if (active) {
          setTodoCount(response.todoCount);
        }
      } catch {
        if (active) {
          setTodoCount(0);
        }
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="Process Card Management" />
          <div>
            <h1>生产工艺卡管理系统</h1>
            <p className="sidebar__eyebrow">Process Card Management</p>
            <p>录入、查询、审批、统计和打印统一在一个内部工作台完成。</p>
          </div>
        </div>

        <div className="sidebar__user">
          <div>
            <strong>{user?.displayName ?? user?.username}</strong>
            <p>
              {user?.username}
              <span className={`role-badge ${isAdmin ? 'role-badge--admin' : ''}`}>
                {isAdmin ? '管理员' : '业务用户'}
              </span>
            </p>
            <p>{workflowRoleText}</p>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={() => void logout()}>
            退出登录
          </button>
        </div>

        <div className="sidebar__group">
          <span className="sidebar__group-title">业务工作台</span>
          <nav className="sidebar__nav">
            <NavLink to="/" end className="nav-link">
              工作台
            </NavLink>
            <NavLink to="/messages" className="nav-link nav-link--with-badge">
              <span>站内消息</span>
              {todoCount > 0 ? <span className="nav-link__badge">{todoCount}</span> : null}
            </NavLink>
            <NavLink to="/cards" end className="nav-link">
              工艺卡列表
            </NavLink>
            <NavLink to="/cards/new" className="nav-link">
              新建工艺卡
            </NavLink>
          </nav>
        </div>

        {isAdmin ? (
          <div className="sidebar__group">
            <span className="sidebar__group-title">系统管理</span>
            <nav className="sidebar__nav">
              <NavLink to="/settings/departments" className="nav-link">
                生产部门设置
              </NavLink>
              <NavLink to="/settings/users" className="nav-link">
                账号管理
              </NavLink>
              <NavLink to="/settings/audit-logs" className="nav-link">
                操作日志
              </NavLink>
            </nav>
          </div>
        ) : null}

        <div className="sidebar__hint">
          <h2>当前说明</h2>
          <p>系统支持编制、确认、审核、批准的受控流程，并保留完整审批留痕。</p>
          <p>站内消息会优先提醒当前角色待处理的工艺卡和最近流转动态。</p>
        </div>
      </aside>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
