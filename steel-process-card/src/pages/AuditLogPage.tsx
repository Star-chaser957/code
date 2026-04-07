import { useEffect, useState } from 'react';
import type { AuditLogCategory, AuditLogEntry, AuditLogFilters, UserAccount } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

const CATEGORY_LABELS: Record<AuditLogCategory, string> = {
  auth: '登录日志',
  process_card: '工艺卡',
  approval: '审批',
  dictionary: '字典',
  user: '账号',
};

export function AuditLogPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<AuditLogFilters>({
    category: '',
    actorUserId: '',
    keyword: '',
  });

  const loadLogs = async (nextFilters: AuditLogFilters) => {
    setLoading(true);
    try {
      const response = await api.listAuditLogs(nextFilters);
      setItems(response.items);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([api.getUserAccounts(), api.listAuditLogs(filters)])
      .then(([userResponse, logResponse]) => {
        setUsers(userResponse.items);
        setItems(logResponse.items);
        setError('');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载操作日志失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const handle = window.setTimeout(() => {
      void loadLogs(filters);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [filters.actorUserId, filters.category, filters.keyword, isAdmin]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Audit Trail</p>
          <h2>操作日志</h2>
          <p>集中查看登录、工艺卡、审批、字典和账号管理的完整留痕。</p>
        </div>
      </header>

      {!isAdmin ? <div className="state state--error">当前账号没有管理员权限。</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      <section className="panel">
        <div className="panel__header">
          <h3>筛选条件</h3>
        </div>
        <div className="filter-grid filter-grid--compact">
          <label className="field">
            <span>日志分类</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value as AuditLogFilters['category'] }))
              }
            >
              <option value="">全部</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>操作人</span>
            <select
              value={filters.actorUserId}
              onChange={(event) => setFilters((current) => ({ ...current, actorUserId: event.target.value }))}
            >
              <option value="">全部</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>关键字</span>
            <input
              value={filters.keyword}
              placeholder="摘要 / 详情 / 操作人 / 目标人"
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>日志结果</h3>
          <span>{loading ? '加载中...' : `最近 ${items.length} 条记录`}</span>
        </div>

        {loading ? <div className="state">正在读取操作日志...</div> : null}

        {!loading ? (
          <div className="audit-log-list">
            {items.map((item) => (
              <article key={item.id} className="audit-log-card">
                <div className="audit-log-card__header">
                  <div>
                    <strong>{item.summary}</strong>
                    <p>
                      {CATEGORY_LABELS[item.category]} · {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className="role-badge">{item.actorDisplayName || '系统'}</span>
                </div>

                <div className="audit-log-card__meta">
                  <span>动作：{item.action}</span>
                  <span>目标：{item.targetDisplayName || '-'}</span>
                  <span>IP：{item.ipAddress || '-'}</span>
                </div>

                {item.detailText ? <p className="audit-log-card__detail">{item.detailText}</p> : null}

                {item.changes.length > 0 ? (
                  <div className="audit-log-card__changes">
                    {item.changes.map((change) => (
                      <div key={`${item.id}-${change.field}`} className="audit-log-change">
                        <strong>{change.field}</strong>
                        <span>{change.before}</span>
                        <span>→</span>
                        <span>{change.after}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {items.length === 0 ? <div className="state">当前筛选条件下没有日志记录。</div> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
