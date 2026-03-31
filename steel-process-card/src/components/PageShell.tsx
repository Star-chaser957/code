import { NavLink, Outlet } from 'react-router-dom';

export function PageShell() {
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
          <h2>当前可维护</h2>
          <p>生产部门已经改成系统字典，可在“系统设置”里增删改顺序。</p>
          <p>录入页优先好填，打印页单独按 A4 竖版优化。</p>
        </div>
      </aside>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
