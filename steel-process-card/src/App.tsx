import { Navigate, Route, Routes } from 'react-router-dom';
import { PageShell } from './components/PageShell';
import { EditorPage } from './pages/EditorPage';
import { ListPage } from './pages/ListPage';
import { PrintPage } from './pages/PrintPage';
import { SettingsDepartmentsPage } from './pages/SettingsDepartmentsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route path="/" element={<ListPage />} />
        <Route path="/cards/new" element={<EditorPage />} />
        <Route path="/cards/:id/edit" element={<EditorPage />} />
        <Route path="/settings/departments" element={<SettingsDepartmentsPage />} />
      </Route>
      <Route path="/cards/:id/print" element={<PrintPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
