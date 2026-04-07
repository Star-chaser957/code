import { NavLink, Outlet } from 'react-router-dom';
import { WORKFLOW_ROLE_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';

export function PageShell() {
  const { isAdmin, logout, user } = useAuth();
  const workflowRoleText = user?.workflowRoles.length
    ? user.workflowRoles.map((roleCode) => WORKFLOW_ROLE_LABELS[roleCode]).join(' / ')
    : '查看';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="Steel Process Card" />
          <div>
            <p className="sidebar__eyebrow">Steel Process Card</p>
            <h1>钢棒/型钢生产工艺卡系统</h1>
            <p>轻量录入、结构化查询、审批留痕与独立打印模板。</p>
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

        <nav className="sidebar__nav">
          <NavLink to="/" end className="nav-link">
            工艺卡列表
          </NavLink>
          <NavLink to="/cards/new" className="nav-link">
            新建工艺卡
          </NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/settings/departments" className="nav-link">
                生产部门设置
              </NavLink>
              <NavLink to="/settings/users" className="nav-link">
                账号管理
              </NavLink>
              <NavLink to="/settings/audit-logs" className="nav-link">
                操作日志
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="sidebar__hint">
          <h2>当前说明</h2>
          <p>工艺卡按编制、确认、审核、批准的受控流程流转。</p>
          <p>已批准的工艺卡会自动锁定，只能查看、导出和打印。</p>
        </div>
      </aside>

      <main className="main-shell">
        <Outlet />
      </main>
    </div>
  );
}
