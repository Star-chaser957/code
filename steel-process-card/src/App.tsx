import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './components/RequireAuth';
import { PageShell } from './components/PageShell';
import { DashboardPage } from './pages/DashboardPage';
import { EditorPage } from './pages/EditorPage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';
import { MessagesPage } from './pages/MessagesPage';
import { PrintPage } from './pages/PrintPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AccountPasswordPage } from './pages/AccountPasswordPage';
import { SettingsDepartmentsPage } from './pages/SettingsDepartmentsPage';
import { UserManagementPage } from './pages/UserManagementPage';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route
        element={
          <RequireAuth>
            <PageShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/account/password" element={<AccountPasswordPage />} />
        <Route path="/cards" element={<ListPage />} />
        <Route path="/cards/new" element={<EditorPage />} />
        <Route path="/cards/:id/edit" element={<EditorPage />} />
        <Route path="/settings/departments" element={<SettingsDepartmentsPage />} />
        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/audit-logs" element={<AuditLogPage />} />
      </Route>
      <Route
        path="/cards/:id/print"
        element={
          <RequireAuth>
            <PrintPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
