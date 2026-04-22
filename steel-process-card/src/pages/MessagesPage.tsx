import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationItem, NotificationOverview } from '../../shared/types';
import { api } from '../lib/api';

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | 'todo' | 'notice';

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

function getTypeLabel(type: NotificationItem['type']) {
  return type === 'todo' ? '待办' : '通知';
}

export function MessagesPage() {
  const [overview, setOverview] = useState<NotificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

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

  const filteredItems = useMemo(() => {
    const items = overview?.items ?? [];

    return items.filter((item) => {
      if (readFilter === 'unread' && item.isRead) {
        return false;
      }

      if (readFilter === 'read' && !item.isRead) {
        return false;
      }

      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [overview?.items, readFilter, typeFilter]);

  const handleMarkRead = async (id: string) => {
    setSubmitting(true);
    try {
      const response = await api.markNotificationRead(id);
      setOverview(response);
      setError('');
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '标记已读失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAllRead = async () => {
    setSubmitting(true);
    try {
      const response = await api.markAllNotificationsRead();
      setOverview(response);
      setError('');
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '全部标记已读失败。');
    } finally {
      setSubmitting(false);
    }
  };

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
          <span className="dashboard-card__label">未读消息</span>
          <strong>{overview?.unreadCount ?? 0}</strong>
        </article>
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
          <span>{loading ? '加载中...' : `共 ${filteredItems.length} 条`}</span>
        </div>

        <div className="notification-toolbar">
          <div className="filter-group">
            <button
              type="button"
              className={`button button--small ${readFilter === 'all' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setReadFilter('all')}
            >
              全部
            </button>
            <button
              type="button"
              className={`button button--small ${readFilter === 'unread' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setReadFilter('unread')}
            >
              未读
            </button>
            <button
              type="button"
              className={`button button--small ${readFilter === 'read' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setReadFilter('read')}
            >
              已读
            </button>
          </div>

          <div className="filter-group">
            <button
              type="button"
              className={`button button--small ${typeFilter === 'all' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setTypeFilter('all')}
            >
              全部类型
            </button>
            <button
              type="button"
              className={`button button--small ${typeFilter === 'todo' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setTypeFilter('todo')}
            >
              只看待办
            </button>
            <button
              type="button"
              className={`button button--small ${typeFilter === 'notice' ? 'button--primary' : 'button--ghost'}`}
              onClick={() => setTypeFilter('notice')}
            >
              只看通知
            </button>
          </div>

          <button
            type="button"
            className="button button--ghost button--small"
            disabled={submitting || (overview?.unreadCount ?? 0) === 0}
            onClick={() => void handleMarkAllRead()}
          >
            全部标记已读
          </button>
        </div>

        {loading ? <div className="state">正在读取站内消息...</div> : null}

        {!loading ? (
          <div className="notification-list">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className={`notification-card notification-card--${item.level} ${item.isRead ? 'notification-card--read' : 'notification-card--unread'}`}
              >
                <div className="notification-card__header">
                  <div>
                    <div className="notification-card__title-row">
                      <span className="notification-card__badge">{getLevelLabel(item.level)}</span>
                      <span className="notification-card__type">{getTypeLabel(item.type)}</span>
                      {!item.isRead ? <span className="notification-card__dot" /> : null}
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="notification-card__actions">
                  {!item.isRead ? (
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={submitting}
                      onClick={() => void handleMarkRead(item.id)}
                    >
                      标记已读
                    </button>
                  ) : null}
                  <Link to={item.to} className="button button--ghost button--small">
                    {item.actionLabel}
                  </Link>
                </div>
              </article>
            ))}

            {filteredItems.length === 0 ? <div className="state">当前筛选条件下没有消息。</div> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
