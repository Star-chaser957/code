import { useEffect, useState } from 'react';
import type { DepartmentOption } from '../../shared/types';
import { api } from '../lib/api';

export function SettingsDepartmentsPage() {
  const [items, setItems] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .getDepartmentOptions()
      .then((response) => {
        setItems(response.items);
        setError('');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const updateLabel = (id: string, label: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: '',
        sortOrder: current.length + 1,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((current) =>
      current
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index + 1 })),
    );
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex + 1,
      }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = items
        .map((item, index) => ({
          ...item,
          label: item.label.trim(),
          sortOrder: index + 1,
        }))
        .filter((item) => item.label);

      const response = await api.saveDepartmentOptions(payload);
      setItems(response.items);
      setMessage('生产部门字典已保存。');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">System Settings</p>
          <h2>生产部门设置</h2>
          <p>维护工序编辑页里的生产部门下拉建议项，保存后立即生效。</p>
        </div>
        <div className="toolbar">
          <button type="button" className="button" onClick={addItem}>
            新增部门
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </header>

      {message ? <div className="state">{message}</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      <section className="panel">
        <div className="panel__header">
          <h3>部门字典</h3>
          <span>{loading ? '加载中...' : `共 ${items.length} 条`}</span>
        </div>

        {loading ? <div className="state">正在读取部门字典...</div> : null}

        {!loading ? (
          <div className="settings-list">
            <div className="settings-head">
              <span>序号</span>
              <span>部门名称</span>
              <span>操作</span>
            </div>

            {items.map((item, index) => (
              <div className="setting-row setting-row--compact" key={item.id}>
                <div className="setting-row__index">{index + 1}</div>

                <input
                  className="setting-row__input"
                  value={item.label}
                  placeholder="请输入部门名称"
                  aria-label={`部门名称 ${index + 1}`}
                  onChange={(event) => updateLabel(item.id, event.target.value)}
                />

                <div className="setting-row__actions">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={index === 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={index === items.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => removeItem(item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
