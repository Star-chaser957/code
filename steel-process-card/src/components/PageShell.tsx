import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

export function PageShell() {
  const { hasWorkflowRole, isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const canCreateCards = hasWorkflowRole('prepare');
  const displayName = user?.displayName ?? user?.username ?? '用户';

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const response = await api.getNotificationOverview();
        if (active) {
          setUnreadCount(response.unreadCount);
        }
      } catch {
        if (active) {
          setUnreadCount(0);
        }
      }
    };

    void loadNotifications();
    const handleRefresh = () => {
      void loadNotifications();
    };
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    window.addEventListener('notifications:changed', handleRefresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('notifications:changed', handleRefresh);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="生产工艺卡管理系统" />
          <div>
            <h1>生产工艺卡管理系统</h1>
            <p className="sidebar__eyebrow">Process Card Management</p>
          </div>
        </div>

        <div className="sidebar__content">
          <div className="sidebar__group">
            <span className="sidebar__group-title">业务工作台</span>
            <nav className="sidebar__nav">
              <NavLink to="/" end className="nav-link">
                工作台
              </NavLink>
              <NavLink to="/messages" className="nav-link nav-link--with-badge">
                <span>站内消息</span>
                {unreadCount > 0 ? <span className="nav-link__badge">{unreadCount}</span> : null}
              </NavLink>
              <NavLink to="/cards" end className="nav-link">
                工艺卡列表
              </NavLink>
              {canCreateCards ? (
                <NavLink to="/cards/new" className="nav-link">
                  新建工艺卡
                </NavLink>
              ) : null}
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

          <div className="sidebar__group">
            <span className="sidebar__group-title">个人信息</span>
            <nav className="sidebar__nav">
              <NavLink to="/account/password" className="nav-link">
                个人账号管理
              </NavLink>
            </nav>
            <div className="sidebar__profile">
              <strong>{displayName}</strong>
              <span className={`role-badge ${isAdmin ? 'role-badge--admin' : ''}`}>
                {isAdmin ? '管理员' : '业务用户'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
