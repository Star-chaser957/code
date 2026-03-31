import { Navigate, Route, Routes } from 'react-router-dom';
import { PageShell } from './components/PageShell';
import { EditorPage } from './pages/EditorPage';
import { ListPage } from './pages/ListPage';
import { PrintPage } from './pages/PrintPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route path="/" element={<ListPage />} />
        <Route path="/cards/new" element={<EditorPage />} />
        <Route path="/cards/:id/edit" element={<EditorPage />} />
      </Route>
      <Route path="/cards/:id/print" element={<PrintPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
