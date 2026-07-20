import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApprovalAction, OperationDefinition, ProcessCardPayload, ProcessCardRevisionDiff } from '../../shared/types';
import {
  APPROVAL_ACTION_COMMENT_REQUIRED,
  APPROVAL_ACTION_LABELS,
  CARD_STATUS_LABELS,
} from '../../shared/types';
import { useToast } from '../components/ToastProvider';
import { PrintTemplate } from '../components/PrintTemplate';
import { api } from '../lib/api';

function isPrimaryApprovalAction(action: ApprovalAction) {
  return action === 'approve' || action === 'submit_approve' || action === 'submit_review';
}

function isReturnApprovalAction(action: ApprovalAction) {
  return action.startsWith('reject_') || action === 'return_prepare';
}

export function PrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [card, setCard] = useState<ProcessCardPayload | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionScopePreset, setRevisionScopePreset] = useState('尚未开始生产，适用于本计划单全部产品');
  const [revisionScopeDetail, setRevisionScopeDetail] = useState('');
  const [revisionDiff, setRevisionDiff] = useState<ProcessCardRevisionDiff | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.9);
  const [autoFit, setAutoFit] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    const load = async () => {
      try {
        const [definitionResponse, detail, diff] = await Promise.all([
          api.getOperationDefinitions(),
          api.getProcessCard(id),
          api.getProcessCardRevisionDiff(id),
        ]);
        setDefinitions(definitionResponse.items);
        setCard(detail);
        setRevisionDiff(diff);
        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '打印预览加载失败');
      }
    };

    void load();
  }, [id]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !autoFit) {
      return;
    }

    const updateScale = () => {
      const pageWidth = 794;
      const availableWidth = Math.max(320, container.clientWidth - 16);
      setPreviewScale(Math.min(1, Math.max(0.55, availableWidth / pageWidth)));
    };
    updateScale();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoFit, card]);

  const changeScale = (nextScale: number) => {
    setAutoFit(false);
    setPreviewScale(Math.min(1.2, Math.max(0.55, nextScale)));
  };

  const handleFullscreen = async () => {
    if (previewContainerRef.current?.requestFullscreen) {
      await previewContainerRef.current.requestFullscreen();
    }
  };

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
      pushToast({
        tone: 'success',
        title: '审批已完成',
        description: `已执行“${APPROVAL_ACTION_LABELS[action]}”`,
      });
      window.dispatchEvent(new Event('notifications:changed'));
      setError('');
      if (action === 'withdraw_review' && updated.id) {
        navigate(`/cards/${updated.id}/edit`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '审批提交失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!card?.id) {
      return;
    }
    const needsScopeDetail = revisionScopePreset === '从指定批号/炉号开始适用' || revisionScopePreset === '自定义范围';
    const effectiveScope = needsScopeDetail
      ? `${revisionScopePreset}：${revisionScopeDetail.trim()}`
      : revisionScopePreset;
    if (!revisionReason.trim() || (needsScopeDetail && !revisionScopeDetail.trim())) {
      setError('请填写修订原因和生效范围。');
      return;
    }

    setSaving(true);
    try {
      const revision = await api.createProcessCardRevision(card.id, {
        reason: revisionReason.trim(),
        effectiveScope,
      });
      setRevisionDialogOpen(false);
      pushToast({ tone: 'success', title: '修订已发起', description: `已生成 V${revision.versionNo}，当前已交给原确认人修改。` });
      navigate(revision.permissions.canEdit ? `/cards/${revision.id}/edit` : `/cards/${revision.id}/print`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建修订稿失败');
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
    <div className={`print-shell ${card.permissions.availableActions.length > 0 ? 'print-shell--has-action' : ''}`}>
      <div className="print-toolbar no-print">
        <div>
          <h2>{card.planNumber || '工艺卡预览'}</h2>
          <p><strong>V{card.versionNo}</strong><span className="review-status-badge">{CARD_STATUS_LABELS[card.status]}</span>{card.currentHandlerName ? `当前处理人：${card.currentHandlerName}` : ''}</p>
        </div>
        <div className="review-toolbar-actions">
          <Link to={card.permissions.canEdit ? `/cards/${card.id}/edit` : '/'} className="button">
            返回列表
          </Link>
          <div className="review-zoom-controls">
            <button type="button" onClick={() => changeScale(previewScale - 0.1)} aria-label="缩小预览">−</button>
            <button type="button" className={autoFit ? 'is-active' : ''} onClick={() => setAutoFit(true)}>适应窗口</button>
            <button type="button" onClick={() => changeScale(previewScale + 0.1)} aria-label="放大预览">＋</button>
            <span>{Math.round(previewScale * 100)}%</span>
          </div>
          <button type="button" className="button button--ghost" onClick={() => void handleFullscreen()}>全屏审阅</button>
          <button type="button" className="button button--primary" onClick={() => window.print()}>
            打印 / 导出 PDF
          </button>
        </div>
      </div>

      {message ? <div className="state no-print">{message}</div> : null}
      {error ? <div className="state state--error no-print">{error}</div> : null}

      <div className="print-review-layout">
        <div className="print-review-document" ref={previewContainerRef}>
          <div className="print-review-scale" style={{ zoom: previewScale }}>
            <PrintTemplate card={card} definitions={definitions} />
          </div>
        </div>

        <aside className="print-review-sidebar no-print">
          {card.permissions.availableActions.length > 0 ? (
            <section className="panel print-review-panel print-review-panel--action">
              <div className="panel__header">
                <div><h3>当前审批</h3><span>{CARD_STATUS_LABELS[card.status]}{card.currentHandlerName ? ` · ${card.currentHandlerName}` : ''}</span></div>
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
                      className={`button ${isPrimaryApprovalAction(action) ? 'button--primary' : isReturnApprovalAction(action) ? 'button--danger-ghost' : 'button--ghost'}`}
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

          {card.versionNo > 1 ? (
            <details className="panel print-review-panel review-disclosure">
              <summary><span><strong>版本信息</strong><small>V{revisionDiff?.sourceVersionNo ?? card.versionNo - 1} → V{card.versionNo}</small></span><span>展开</span></summary>
              <dl className="revision-meta">
                <div><dt>修订原因</dt><dd>{card.revisionReason || '-'}</dd></div>
                <div><dt>生效范围</dt><dd>{card.revisionEffectiveScope || '-'}</dd></div>
              </dl>
              <div className="revision-changes">
                <strong>相对上一版本的变化（{revisionDiff?.changes.length ?? 0}项）</strong>
                {revisionDiff?.changes.map((change) => (
                  <div className="revision-change" key={change.field}><b>{change.field}</b><span className="revision-change__before">原：{change.before}</span><span className="revision-change__after">新：{change.after}</span></div>
                ))}
              </div>
              {card.sourceCardId ? <Link className="link-button" to={`/cards/${card.sourceCardId}/print`}>查看上一版本</Link> : null}
            </details>
          ) : null}

          <details className="panel print-review-panel review-disclosure">
            <summary><span><strong>审批历史</strong><small>共 {card.approvalLogs.length} 条</small></span><span>展开</span></summary>
            {card.approvalLogs.length === 0 ? <div className="state">当前还没有审批记录。</div> : (
              <div className="timeline">
                {card.approvalLogs.map((log) => (
                  <div key={log.id} className="timeline__item"><strong>{APPROVAL_ACTION_LABELS[log.action]}</strong><span>{log.actorDisplayName}</span><span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>{log.comment ? <p>{log.comment}</p> : null}</div>
                ))}
              </div>
            )}
          </details>

          {card.permissions.canRevise ? (
            <section className="panel print-review-panel revision-create-entry">
              <div><strong>生产环节发现工艺不适用？</strong><span>原批准版本将保留，新版本重新审批。</span></div>
              <button type="button" className="button button--ghost" onClick={() => setRevisionDialogOpen(true)}>发起受控修订</button>
            </section>
          ) : null}
        </aside>
      </div>

      {revisionDialogOpen ? (
        <div className="modal-backdrop no-print" role="presentation" onMouseDown={() => setRevisionDialogOpen(false)}>
          <section className="modal-card revision-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel__header"><div><h3 id="revision-dialog-title">发起 V{card.versionNo + 1} 受控修订</h3><span>新版本将交给原确认人修改，再依次提交审核和批准；原编制人保持不变。</span></div></div>
            <div className="stack stack--compact">
              <label className="field"><span>修订原因</span><textarea className="textarea--fixed" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="说明为什么当前工艺无法落实" autoFocus /></label>
              <label className="field"><span>生效范围（新版本从哪里开始适用）</span>
                <select value={revisionScopePreset} onChange={(event) => setRevisionScopePreset(event.target.value)}>
                  <option value="尚未开始生产，适用于本计划单全部产品">尚未开始生产，适用于本计划单全部产品</option>
                  <option value="仅适用于尚未完成的工序">仅适用于尚未完成的工序</option>
                  <option value="从指定批号/炉号开始适用">从指定批号/炉号开始适用</option>
                  <option value="自定义范围">自定义范围</option>
                </select>
                {(revisionScopePreset === '从指定批号/炉号开始适用' || revisionScopePreset === '自定义范围') ? (
                  <textarea className="textarea--fixed" value={revisionScopeDetail} onChange={(event) => setRevisionScopeDetail(event.target.value)} placeholder="请写明批号、炉号、数量、工序或生效日期" />
                ) : null}
              </label>
              <div className="toolbar revision-dialog__actions"><button type="button" className="button button--ghost" onClick={() => setRevisionDialogOpen(false)}>取消</button><button type="button" className="button button--primary" disabled={saving} onClick={() => void handleCreateRevision()}>{saving ? '正在创建...' : '创建修订稿'}</button></div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
