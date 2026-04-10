import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationItem, NotificationOverview } from '../../shared/types';
import { api } from '../lib/api';

function getLevelLabel(level: NotificationItem['level']) {
  switch (level) {
    case 'todo':
      return '待办';
    case 'warning':
      return '提醒';
    case 'success':
      return '通知';
    default:
      return '消息';
  }
}

export function MessagesPage() {
  const [overview, setOverview] = useState<NotificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void api
      .getNotificationOverview()
      .then((response) => {
        if (!active) {
          return;
        }
        setOverview(response);
        setError('');
      })
      .catch((reason) => {
        if (!active) {
          return;
        }
        setError(reason instanceof Error ? reason.message : '加载站内消息失败。');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Message Center</p>
          <h2>站内消息</h2>
          <p>集中查看与你相关的待办提醒、退回意见和最近流程动态。</p>
        </div>
      </header>

      {error ? <div className="state state--error">{error}</div> : null}

      <section className="dashboard-grid dashboard-grid--tasks">
        <article className="panel dashboard-card">
          <span className="dashboard-card__label">待办提醒</span>
          <strong>{overview?.todoCount ?? 0}</strong>
        </article>
        <article className="panel dashboard-card">
          <span className="dashboard-card__label">消息总数</span>
          <strong>{overview?.totalCount ?? 0}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>消息列表</h3>
          <span>{loading ? '加载中...' : `共 ${overview?.items.length ?? 0} 条`}</span>
        </div>

        {loading ? <div className="state">正在读取站内消息...</div> : null}

        {!loading ? (
          <div className="notification-list">
            {overview?.items.map((item) => (
              <article key={item.id} className={`notification-card notification-card--${item.level}`}>
                <div className="notification-card__header">
                  <div>
                    <span className="notification-card__badge">{getLevelLabel(item.level)}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p>{item.description}</p>
                <div className="notification-card__actions">
                  <Link to={item.to} className="button button--ghost button--small">
                    {item.actionLabel}
                  </Link>
                </div>
              </article>
            ))}

            {!overview?.items.length ? <div className="state">当前没有新的站内消息。</div> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
