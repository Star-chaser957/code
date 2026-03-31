import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function PageShell() {
  const { isAdmin, logout, user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="江苏星火集团" />
          <div>
            <p className="sidebar__eyebrow">Steel Process Card</p>
            <h1>钢棒/型钢生产工艺卡系统</h1>
            <p>轻量录入、结构化查询、独立打印模板。</p>
          </div>
        </div>

        <div className="sidebar__user">
          <div>
            <strong>{user?.displayName ?? user?.username}</strong>
            <p>
              {user?.username}
              <span className={`role-badge ${isAdmin ? 'role-badge--admin' : ''}`}>
                {isAdmin ? '管理员' : '普通用户'}
              </span>
            </p>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={() => void logout()}>
            退出登录
          </button>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end className="nav-link">
            工艺卡列表
          </NavLink>
          <NavLink to="/cards/new" className="nav-link">
            新建工艺卡
          </NavLink>
          <NavLink to="/settings/departments" className="nav-link">
            系统设置
          </NavLink>
        </nav>

        <div className="sidebar__hint">
          <h2>当前说明</h2>
          <p>普通登录账号可以录入、查询、编辑和打印工艺卡。</p>
          <p>系统字典仅管理员账号可维护，普通账号进入后为只读查看。</p>
        </div>
      </aside>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
