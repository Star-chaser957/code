import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

function NavIcon({ children }: { children: ReactNode }) {
  return <span className="nav-link__icon" aria-hidden="true">{children}</span>;
}

export function PageShell() {
  const { hasWorkflowRole, isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem('sidebar-collapsed') === 'true',
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      window.localStorage.setItem('sidebar-collapsed', String(!current));
      return !current;
    });
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <button
        type="button"
        className={`sidebar-backdrop ${mobileMenuOpen ? 'is-visible' : ''}`}
        aria-label="关闭导航"
        onClick={closeMobileMenu}
      />
      <aside className={`sidebar ${mobileMenuOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar__brand">
          <img src="/logo.png" alt="生产工艺卡管理系统" />
          <div>
            <h1>生产工艺卡管理系统</h1>
            <p className="sidebar__eyebrow">Process Card Management</p>
          </div>
          <button type="button" className="sidebar__collapse" onClick={toggleSidebar} title={sidebarCollapsed ? '展开导航' : '收起导航'}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <div className="sidebar__content">
          <div className="sidebar__group">
            <span className="sidebar__group-title">业务工作台</span>
            <nav className="sidebar__nav">
              <NavLink to="/" end className="nav-link" onClick={closeMobileMenu} title="工作台">
                <NavIcon>⌂</NavIcon><span className="nav-link__label">工作台</span>
              </NavLink>
              <NavLink to="/messages" className="nav-link nav-link--with-badge" onClick={closeMobileMenu} title="站内消息">
                <span className="nav-link__main"><NavIcon>◉</NavIcon><span className="nav-link__label">站内消息</span></span>
                {unreadCount > 0 ? <span className="nav-link__badge">{unreadCount}</span> : null}
              </NavLink>
              <NavLink to="/cards" end className="nav-link" onClick={closeMobileMenu} title="工艺卡列表">
                <NavIcon>▤</NavIcon><span className="nav-link__label">工艺卡列表</span>
              </NavLink>
              <NavLink to="/production-plans" className="nav-link" onClick={closeMobileMenu} title="计划单列表">
                <NavIcon>▧</NavIcon><span className="nav-link__label">计划单列表</span>
              </NavLink>
              {canCreateCards ? (
                <NavLink to="/cards/new" className="nav-link" onClick={closeMobileMenu} title="新建工艺卡">
                  <NavIcon>＋</NavIcon><span className="nav-link__label">新建工艺卡</span>
                </NavLink>
              ) : null}
            </nav>
          </div>

          {isAdmin ? (
            <div className="sidebar__group">
              <span className="sidebar__group-title">系统管理</span>
              <nav className="sidebar__nav">
                <NavLink to="/settings/departments" className="nav-link" onClick={closeMobileMenu} title="生产部门设置">
                  <NavIcon>◇</NavIcon><span className="nav-link__label">生产部门设置</span>
                </NavLink>
                <NavLink to="/settings/users" className="nav-link" onClick={closeMobileMenu} title="账号管理">
                  <NavIcon>◎</NavIcon><span className="nav-link__label">账号管理</span>
                </NavLink>
                <NavLink to="/settings/audit-logs" className="nav-link" onClick={closeMobileMenu} title="操作日志">
                  <NavIcon>≡</NavIcon><span className="nav-link__label">操作日志</span>
                </NavLink>
              </nav>
            </div>
          ) : null}

          <div className="sidebar__group">
            <span className="sidebar__group-title">个人信息</span>
            <nav className="sidebar__nav">
              <NavLink to="/account/password" className="nav-link" onClick={closeMobileMenu} title="个人账号管理">
                <NavIcon>●</NavIcon><span className="nav-link__label">个人账号管理</span>
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
        <button type="button" className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)}>
          <span aria-hidden="true">☰</span> 菜单
        </button>
        <Outlet />
      </main>
    </div>
  );
}
