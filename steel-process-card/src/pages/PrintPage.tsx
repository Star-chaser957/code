import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApprovalAction, OperationDefinition, ProcessCardPayload } from '../../shared/types';
import {
  APPROVAL_ACTION_COMMENT_REQUIRED,
  APPROVAL_ACTION_LABELS,
  CARD_STATUS_LABELS,
} from '../../shared/types';
import { PrintTemplate } from '../components/PrintTemplate';
import { api } from '../lib/api';

export function PrintPage() {
  const { id } = useParams();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [card, setCard] = useState<ProcessCardPayload | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const load = async () => {
      try {
        const [definitionResponse, detail] = await Promise.all([
          api.getOperationDefinitions(),
          api.getProcessCard(id),
        ]);
        setDefinitions(definitionResponse.items);
        setCard(detail);
        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '打印预览加载失败');
      }
    };

    void load();
  }, [id]);

  const handleWorkflowAction = async (action: ApprovalAction) => {
    if (!card?.id) {
      return;
    }

    setSaving(true);
    try {
      if (APPROVAL_ACTION_COMMENT_REQUIRED.includes(action) && !approvalComment.trim()) {
        throw new Error('当前动作需要填写修改意见。');
      }

      const updated = await api.performApprovalAction(card.id, {
        action,
        comment: approvalComment.trim(),
      });
      setCard(updated);
      setApprovalComment('');
      setMessage(`流程动作“${APPROVAL_ACTION_LABELS[action]}”已完成。`);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '审批提交失败');
    } finally {
      setSaving(false);
    }
  };

  if (error && !card) {
    return (
      <div className="page">
        <div className="state state--error">{error}</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="page">
        <div className="state">正在生成预览...</div>
      </div>
    );
  }

  return (
    <div className="print-shell">
      <div className="print-toolbar no-print">
        <div>
          <p className="page__eyebrow">Review Preview</p>
          <h2>工艺卡预览</h2>
          <p>
            当前状态：<strong>{CARD_STATUS_LABELS[card.status]}</strong>
            {card.currentHandlerName ? `，当前处理人：${card.currentHandlerName}` : ''}
          </p>
        </div>
        <div className="toolbar">
          <Link to={card.permissions.canEdit ? `/cards/${card.id}/edit` : '/'} className="button">
            返回
          </Link>
          <button type="button" className="button button--primary" onClick={() => window.print()}>
            浏览器打印 / 导出 PDF
          </button>
        </div>
      </div>

      {message ? <div className="state no-print">{message}</div> : null}
      {error ? <div className="state state--error no-print">{error}</div> : null}

      <div className="print-review-layout">
        <div className="print-review-document">
          <PrintTemplate card={card} definitions={definitions} />
        </div>

        <aside className="print-review-sidebar no-print">
          <section className="panel print-review-panel">
            <div className="panel__header">
              <h3>审批历史</h3>
            </div>
            {card.approvalLogs.length === 0 ? (
              <div className="state">当前还没有审批记录。</div>
            ) : (
              <div className="timeline">
                {card.approvalLogs.map((log) => (
                  <div key={log.id} className="timeline__item">
                    <strong>{APPROVAL_ACTION_LABELS[log.action]}</strong>
                    <span>{log.actorDisplayName}</span>
                    <span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                    {log.comment ? <p>{log.comment}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {card.permissions.availableActions.length > 0 ? (
            <section className="panel print-review-panel">
              <div className="panel__header">
                <h3>审批操作</h3>
                <span>请先审阅左侧 PDF 版式，再填写意见并执行审批动作。</span>
              </div>
              <div className="workflow-actions workflow-actions--full">
                <label className="field field--full">
                  <span>审批意见</span>
                  <textarea
                    className="textarea--fixed"
                    value={approvalComment}
                    onChange={(event) => setApprovalComment(event.target.value)}
                    placeholder="退回或驳回时请填写明确修改意见。"
                  />
                </label>
                <div className="toolbar">
                  {card.permissions.availableActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="button"
                      disabled={saving}
                      onClick={() => void handleWorkflowAction(action)}
                    >
                      {saving ? '处理中...' : APPROVAL_ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
