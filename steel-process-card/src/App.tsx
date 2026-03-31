import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './components/RequireAuth';
import { PageShell } from './components/PageShell';
import { EditorPage } from './pages/EditorPage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';
import { PrintPage } from './pages/PrintPage';
import { SettingsDepartmentsPage } from './pages/SettingsDepartmentsPage';

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
        <Route path="/" element={<ListPage />} />
        <Route path="/cards/new" element={<EditorPage />} />
        <Route path="/cards/:id/edit" element={<EditorPage />} />
        <Route path="/settings/departments" element={<SettingsDepartmentsPage />} />
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
