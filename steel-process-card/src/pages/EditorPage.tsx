import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEmptyOperation, createEmptyProcessCard } from '../../shared/process-catalog';
import type {
  ApprovalAction,
  CardOperation,
  DepartmentOption,
  OperationDefinition,
  ProcessCardPayload,
  ProductPrefillCandidate,
  UserSummary,
} from '../../shared/types';
import {
  APPROVAL_ACTION_COMMENT_REQUIRED,
  APPROVAL_ACTION_LABELS,
  CARD_STATUS_LABELS,
  FIXED_REMARK,
  MAIN_INFO_FIELDS,
} from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { OperationEditor } from '../components/OperationEditor';
import { PrintTemplate } from '../components/PrintTemplate';
import { useToast } from '../components/ToastProvider';
import { api } from '../lib/api';

function sortOperations(operations: CardOperation[]) {
  return [...operations].sort((left, right) => left.sortOrder - right.sortOrder);
}

function clonePrefillOperations(
  definitions: OperationDefinition[],
  operations: CardOperation[],
): CardOperation[] {
  const sourceMap = new Map(operations.map((operation) => [operation.operationCode, operation]));

  return definitions.map((definition) => {
    const source = sourceMap.get(definition.code);

    if (!source) {
      return createEmptyOperation(definition);
    }

    return {
      ...source,
      id: undefined,
      remark: '',
      details: source.details.map((detail, index) => ({
        ...detail,
        id: undefined,
        detailSeq: index + 1,
      })),
    };
  });
}

function getDefaultWorkflowAssignee(
  users: UserSummary[],
  role: 'confirm' | 'review' | 'approve',
  currentUserId?: string,
) {
  const nonAdminOthers = users.filter(
    (item) => item.isActive && item.role !== 'admin' && item.workflowRoles.includes(role) && item.id !== currentUserId,
  );
  if (nonAdminOthers[0]) {
    return nonAdminOthers[0].id;
  }

  const nonAdmin = users.filter(
    (item) => item.isActive && item.role !== 'admin' && item.workflowRoles.includes(role),
  );
  if (nonAdmin[0]) {
    return nonAdmin[0].id;
  }

  const fallback = users.find((item) => item.isActive && item.workflowRoles.includes(role) && item.id !== currentUserId);
  return fallback?.id ?? '';
}

function validateCardBeforeSave(card: ProcessCardPayload) {
  for (const field of MAIN_INFO_FIELDS) {
    const value = String(card[field.key] ?? '').trim();
    if (!value) {
      return `${field.label}不能为空。`;
    }
  }

  if (!card.confirmedUserId.trim()) {
    return '请选择确认人后再保存。';
  }

  if (!card.reviewedUserId.trim()) {
    return '请选择审核人后再保存。';
  }

  if (!card.approvedUserId.trim()) {
    return '请选择批准人后再保存。';
  }

  return '';
}

function validateCardForSubmit(card: ProcessCardPayload) {
  if (!card.planNumber.trim()) {
    return '计划单号不能为空。';
  }

  if (!card.productName.trim()) {
    return '产品名称不能为空。';
  }

  if (!card.confirmedUserId.trim()) {
    return '请选择确认人后再保存。';
  }

  if (!card.reviewedUserId.trim()) {
    return '请选择审核人后再保存。';
  }

  if (!card.approvedUserId.trim()) {
    return '请选择批准人后再保存。';
  }

  return '';
}

export function EditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, hasWorkflowRole } = useAuth();
  const { pushToast } = useToast();
  const isEditMode = Boolean(id);

  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [card, setCard] = useState<ProcessCardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillCandidates, setPrefillCandidates] = useState<ProductPrefillCandidate[]>([]);
  const [selectedPrefillId, setSelectedPrefillId] = useState('');
  const [operationPickerExpanded, setOperationPickerExpanded] = useState(!isEditMode);

  const showErrorDialog = (messageText: string) => {
    setError(messageText);
    setMessage('');
    window.alert(messageText);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [definitionResponse, departmentResponse, userResponse] = await Promise.all([
          api.getOperationDefinitions(),
          api.getDepartmentOptions(),
          api.getUsers(),
        ]);

        setDefinitions(definitionResponse.items);
        setDepartmentOptions(departmentResponse.items);
        setUsers(userResponse.items);

        if (id) {
          const detail = await api.getProcessCard(id);
          setCard({ ...detail, remark: FIXED_REMARK });
        } else {
          const emptyCard = createEmptyProcessCard(definitionResponse.items);
          emptyCard.createdByUserId = user?.id ?? '';
          emptyCard.createdByName = user?.displayName ?? user?.username ?? '';
          emptyCard.confirmedUserId = getDefaultWorkflowAssignee(userResponse.items, 'confirm', user?.id);
          emptyCard.reviewedUserId = getDefaultWorkflowAssignee(userResponse.items, 'review', user?.id);
          emptyCard.approvedUserId = getDefaultWorkflowAssignee(userResponse.items, 'approve', user?.id);
          setCard(emptyCard);
        }

        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, user?.displayName, user?.id, user?.username]);

  useEffect(() => {
    if (isEditMode || !card?.productName.trim()) {
      setPrefillCandidates([]);
      setSelectedPrefillId('');
      setPrefillLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      setPrefillLoading(true);
      void api
        .getProductPrefill(card.productName.trim())
        .then((response) => {
          setPrefillCandidates(response.items);
          setSelectedPrefillId(response.items[0]?.sourceCardId ?? '');
        })
        .catch(() => {
          setPrefillCandidates([]);
          setSelectedPrefillId('');
        })
        .finally(() => setPrefillLoading(false));
    }, 350);

    return () => window.clearTimeout(handle);
  }, [card?.productName, isEditMode]);

  const selectedPrefillCandidate = useMemo(
    () => prefillCandidates.find((item) => item.sourceCardId === selectedPrefillId) ?? null,
    [prefillCandidates, selectedPrefillId],
  );

  const enabledOperations = useMemo(
    () => sortOperations((card?.operations ?? []).filter((item) => item.enabled)),
    [card],
  );

  useEffect(() => {
    if (enabledOperations.length === 0) {
      setOperationPickerExpanded(true);
    }
  }, [enabledOperations.length]);

  const canEdit = !isEditMode || Boolean(card?.permissions.canEdit);
  const showApprovalPreview =
    isEditMode && !canEdit && Boolean(card?.permissions.availableActions.length);

  const availableActions = useMemo<ApprovalAction[]>(() => {
    if (isEditMode) {
      return card?.permissions.availableActions ?? [];
    }

    return hasWorkflowRole('prepare') ? ['submit_confirm'] : [];
  }, [card?.permissions.availableActions, hasWorkflowRole, isEditMode]);

  const selectableUsers = useMemo(
    () => {
      const sortCandidates = (role: 'confirm' | 'review' | 'approve') =>
        users
          .filter((item) => item.isActive && (item.role === 'admin' || item.workflowRoles.includes(role)))
          .sort((left, right) => Number(left.role === 'admin') - Number(right.role === 'admin'));

      return {
        confirm: sortCandidates('confirm'),
        review: sortCandidates('review'),
        approve: sortCandidates('approve'),
      };
    },
    [users],
  );

  const updateOperation = (operationCode: string, updater: (current: CardOperation) => CardOperation) => {
    setCard((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        operations: current.operations.map((item) =>
          item.operationCode === operationCode ? updater(item) : item,
        ),
      };
    });
  };

  const toggleOperation = (operationCode: string) => {
    if (!canEdit) {
      return;
    }

    setCard((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        operations: current.operations.map((item) =>
          item.operationCode === operationCode ? { ...item, enabled: !item.enabled } : item,
        ),
      };
    });
  };

  const moveOperation = (operationCode: string, direction: -1 | 1) => {
    if (!canEdit) {
      return;
    }

    setCard((current) => {
      if (!current) {
        return current;
      }

      const enabled = sortOperations(current.operations.filter((item) => item.enabled));
      const index = enabled.findIndex((item) => item.operationCode === operationCode);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= enabled.length) {
        return current;
      }

      const reordered = [...enabled];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      const orderMap = new Map(
        reordered.map((item, currentIndex) => [item.operationCode, (currentIndex + 1) * 10]),
      );

      return {
        ...current,
        operations: current.operations.map((item) =>
          orderMap.has(item.operationCode)
            ? { ...item, sortOrder: orderMap.get(item.operationCode) ?? item.sortOrder }
            : item,
        ),
      };
    });
  };

  const handleApplyPrefill = () => {
    if (!card || !selectedPrefillCandidate) {
      return;
    }

    setCard({
      ...card,
      operations: clonePrefillOperations(definitions, selectedPrefillCandidate.operations),
    });
    setMessage(`已带入计划单号 ${selectedPrefillCandidate.planNumber} 的历史工序配置。`);
    setError('');
  };

  const persistCard = async (currentCard: ProcessCardPayload) => {
    const payload = { ...currentCard, remark: FIXED_REMARK };
    const saved =
      isEditMode && id ? await api.updateProcessCard(id, payload) : await api.createProcessCard(payload);
    setCard({ ...saved, remark: FIXED_REMARK });

    if (!isEditMode) {
      navigate(`/cards/${saved.id}/edit`, { replace: true });
    }

    return saved;
  };

  const handleSave = async () => {
    if (!card) {
      return;
    }

    const validationError = validateCardBeforeSave(card);
    if (validationError) {
      setError(validationError);
      setMessage('');
      return;
    }

    setSaving(true);
    try {
      await persistCard(card);
      setMessage('工艺卡已保存。');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflowAction = async (action: ApprovalAction) => {
    if (!card) {
      return;
    }

    const validationError = validateCardBeforeSave(card);
    if (validationError) {
      setError(validationError);
      setMessage('');
      return;
    }

    setSaving(true);
    try {
      let latest = card;
      if (!latest.id || latest.permissions.canEdit) {
        latest = await persistCard(latest);
      }

      if (APPROVAL_ACTION_COMMENT_REQUIRED.includes(action) && !approvalComment.trim()) {
        throw new Error('当前动作需要填写修改意见。');
      }

      const updated = await api.performApprovalAction(latest.id!, {
        action,
        comment: approvalComment.trim(),
      });
      setCard(updated);
      setApprovalComment('');
      setMessage(`流程动作“${APPROVAL_ACTION_LABELS[action]}”已完成。`);
      pushToast({
        tone: 'success',
        title: '流程已提交',
        description: `已执行“${APPROVAL_ACTION_LABELS[action]}”`,
      });
      window.dispatchEvent(new Event('notifications:changed'));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '流程提交失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWithPrompt = async () => {
    if (!card) {
      return;
    }

    const validationError = validateCardForSubmit(card);
    if (validationError) {
      showErrorDialog(validationError);
      return;
    }

    setSaving(true);
    try {
      await persistCard(card);
      setMessage('工艺卡已保存。');
      setError('');
    } catch (reason) {
      showErrorDialog(reason instanceof Error ? reason.message : '保存失败，请稍后再试。');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflowActionWithPrompt = async (action: ApprovalAction) => {
    if (!card) {
      return;
    }

    const validationError = validateCardForSubmit(card);
    if (validationError) {
      showErrorDialog(validationError);
      return;
    }

    setSaving(true);
    try {
      let latest = card;
      if (!latest.id || latest.permissions.canEdit) {
        latest = await persistCard(latest);
      }

      if (APPROVAL_ACTION_COMMENT_REQUIRED.includes(action) && !approvalComment.trim()) {
        throw new Error('当前动作需要填写修改意见。');
      }

      const updated = await api.performApprovalAction(latest.id!, {
        action,
        comment: approvalComment.trim(),
      });
      setCard(updated);
      setApprovalComment('');
      setMessage(`流程动作“${APPROVAL_ACTION_LABELS[action]}”已完成。`);
      pushToast({
        tone: 'success',
        title: '流程已提交',
        description: `已执行“${APPROVAL_ACTION_LABELS[action]}”`,
      });
      window.dispatchEvent(new Event('notifications:changed'));
      setError('');
    } catch (reason) {
      showErrorDialog(reason instanceof Error ? reason.message : '流程提交失败，请稍后再试。');
    } finally {
      setSaving(false);
    }
  };

  void handleSave;
  void handleWorkflowAction;

  if (loading || !card) {
    return (
      <div className="page">
        <div className="state">正在加载工艺卡...</div>
      </div>
    );
  }

  return (
    <div className="page page--editor">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Card Workflow</p>
          <h2>{isEditMode ? '工艺卡处理' : '新建工艺卡'}</h2>
          <p>
            当前状态：<strong>{CARD_STATUS_LABELS[card.status]}</strong>
            {card.currentHandlerName ? `，当前处理人：${card.currentHandlerName}` : ''}
          </p>
        </div>
      </header>

      {message ? <div className="state">{message}</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      {showApprovalPreview ? (
        <>
          <section className="panel">
            <div className="panel__header">
              <h3>审阅表单</h3>
              <span>审核和批准视角默认按打印版式审阅，便于直接对照纸质卡审批。</span>
            </div>
            <div className="editor-print-preview">
              <PrintTemplate card={card} definitions={definitions} />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>流程摘要</h3>
              <span>这里只保留审批时最需要关注的信息。</span>
            </div>
            <div className="review-summary-grid">
              <label className="field">
                <span>计划单号</span>
                <input value={card.planNumber} readOnly />
              </label>
              <label className="field">
                <span>产品名称</span>
                <input value={card.productName} readOnly />
              </label>
              <label className="field">
                <span>当前状态</span>
                <input value={CARD_STATUS_LABELS[card.status]} readOnly />
              </label>
              <label className="field">
                <span>当前处理人</span>
                <input value={card.currentHandlerName || '-'} readOnly />
              </label>
              <label className="field">
                <span>编制</span>
                <input value={`${card.preparedBy || ''} ${card.preparedDate || ''}`.trim() || '-'} readOnly />
              </label>
              <label className="field">
                <span>确认</span>
                <input value={`${card.confirmedBy || ''} ${card.confirmedDate || ''}`.trim() || '-'} readOnly />
              </label>
              <label className="field">
                <span>审核</span>
                <input value={`${card.reviewedBy || ''} ${card.reviewedDate || ''}`.trim() || '-'} readOnly />
              </label>
              <label className="field">
                <span>批准</span>
                <input value={`${card.approvedBy || ''} ${card.approvedDate || ''}`.trim() || '-'} readOnly />
              </label>
              <label className="field field--full">
                <span>最近退回意见</span>
                <textarea className="textarea--fixed" value={card.lastReturnComment || '-'} readOnly />
              </label>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="panel panel--compact operation-panel">
            <div className="panel__header">
              <h3>主信息</h3>
            </div>

            <div className="form-grid form-grid--editor">
              {MAIN_INFO_FIELDS.map((field) => (
                <label key={field.key} className={`field ${field.type === 'textarea' ? 'field--full' : ''}`}>
                  <span>{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      className={field.large ? 'textarea--large' : undefined}
                      disabled={!canEdit}
                      value={card[field.key] as string}
                      onChange={(event) =>
                        setCard((current) => current && { ...current, [field.key]: event.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      disabled={!canEdit}
                      value={card[field.key] as string}
                      onChange={(event) =>
                        setCard((current) => current && { ...current, [field.key]: event.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>

            {!isEditMode && canEdit && card.productName.trim() ? (
              <div className="prefill-card">
                <div>
                  <strong>同产品历史工序配置</strong>
                  <p>
                    {prefillLoading
                      ? '正在查询同产品历史工艺卡...'
                      : prefillCandidates.length > 0
                        ? `找到 ${prefillCandidates.length} 张历史工艺卡，请选择其中一张带入。`
                        : '当前还没有找到同产品名称的历史工艺卡。'}
                  </p>
                </div>

                {prefillCandidates.length > 0 ? (
                  <div className="prefill-actions">
                    <label className="field">
                      <span>历史工艺卡</span>
                      <select value={selectedPrefillId} onChange={(event) => setSelectedPrefillId(event.target.value)}>
                        {prefillCandidates.map((item) => (
                          <option key={item.sourceCardId} value={item.sourceCardId}>
                            {item.planNumber} | {new Date(item.updatedAt).toLocaleString('zh-CN')}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button type="button" className="button" onClick={handleApplyPrefill}>
                      带入所选工序配置
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="panel panel--compact operation-panel">
            <div className="panel__header">
              <div>
                <h3>工序启用</h3>
                <span>先选择需要的工序，选完后可以收起选择区，低分辨率电脑会更方便填写。</span>
              </div>
              <div className="toolbar">
                <span className="operation-picker-count">已启用 {enabledOperations.length} 道</span>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setOperationPickerExpanded((current) => !current)}
                >
                  {operationPickerExpanded ? '收起选择区' : '展开选择区'}
                </button>
              </div>
            </div>

            {enabledOperations.length > 0 ? (
              <div className="operation-picker-summary">
                {enabledOperations.map((operation) => {
                  const definition = definitions.find((item) => item.code === operation.operationCode);
                  if (!definition) {
                    return null;
                  }

                  return (
                    <button
                      type="button"
                      key={operation.operationCode}
                      className="chip chip--compact"
                      disabled={!canEdit}
                      onClick={() => toggleOperation(operation.operationCode)}
                    >
                      {definition.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {operationPickerExpanded ? (
              <div className="operation-picker-grid">
                {definitions.map((definition) => {
                  const operation = card.operations.find((item) => item.operationCode === definition.code);
                  const enabled = operation?.enabled ?? false;

                  return (
                    <button
                      type="button"
                      key={definition.code}
                      className={`chip-button chip-button--dense ${enabled ? 'is-active' : ''}`}
                      disabled={!canEdit}
                      onClick={() => toggleOperation(definition.code)}
                    >
                      {definition.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="panel panel--compact operation-panel operation-panel--legacy">
            <div className="panel__header">
              <h3>工序启用</h3>
              <span>启用后下方会显示对应编辑卡片。</span>
            </div>
            <div className="chip-grid chip-grid--toolbar chip-grid--compact">
              {definitions.map((definition) => {
                const operation = card.operations.find((item) => item.operationCode === definition.code);
                const enabled = operation?.enabled ?? false;

                return (
                  <button
                    type="button"
                    key={definition.code}
                    className={`chip-button ${enabled ? 'is-active' : ''}`}
                    disabled={!canEdit}
                    onClick={() => toggleOperation(definition.code)}
                  >
                    {definition.name}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="stack stack--compact">
            {enabledOperations.length === 0 ? (
              <div className="state">请先选择需要启用的工序，已启用工序会显示在这里供你填写。</div>
            ) : null}

            {enabledOperations.map((operation) => {
              const definition = definitions.find((item) => item.code === operation.operationCode);
              if (!definition) {
                return null;
              }

              const enabledIndex = enabledOperations.findIndex(
                (item) => item.operationCode === operation.operationCode,
              );

              return (
                <OperationEditor
                  key={operation.operationCode}
                  definition={definition}
                  operation={operation}
                  departmentOptions={departmentOptions}
                  readOnly={!canEdit}
                  onToggleEnabled={() => toggleOperation(operation.operationCode)}
                  onChange={(updater) => updateOperation(operation.operationCode, updater)}
                  onMoveUp={() => moveOperation(operation.operationCode, -1)}
                  onMoveDown={() => moveOperation(operation.operationCode, 1)}
                  disableMoveUp={enabledIndex <= 0}
                  disableMoveDown={enabledIndex === enabledOperations.length - 1}
                />
              );
            })}
          </section>
        </>
      )}

      {!showApprovalPreview ? (
        <section className="panel panel--compact">
          <div className="panel__header">
            <h3>流程与签字</h3>
            <span>签字信息由流程动作自动回填，不再手工编辑。</span>
          </div>

          <div className="form-grid form-grid--editor">
            <label className="field">
              <span>编制人</span>
              <input value={card.createdByName || user?.displayName || ''} readOnly />
            </label>
            <label className="field">
              <span>确认人</span>
              <select
                disabled={!canEdit}
                value={card.confirmedUserId}
                onChange={(event) =>
                  setCard((current) => current && { ...current, confirmedUserId: event.target.value })
                }
              >
                <option value="">请选择</option>
                {selectableUsers.confirm.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>审核人</span>
              <select
                disabled={!canEdit}
                value={card.reviewedUserId}
                onChange={(event) =>
                  setCard((current) => current && { ...current, reviewedUserId: event.target.value })
                }
              >
                <option value="">请选择</option>
                {selectableUsers.review.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>批准人</span>
              <select
                disabled={!canEdit}
                value={card.approvedUserId}
                onChange={(event) =>
                  setCard((current) => current && { ...current, approvedUserId: event.target.value })
                }
              >
                <option value="">请选择</option>
                {selectableUsers.approve.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>

            <div className="field field--full">
              <span>签字信息</span>
              <div className="signature-summary">
                <div className="signature-summary__item">
                  <strong>编制</strong>
                  <span>{`${card.preparedBy || ''} ${card.preparedDate || ''}`.trim() || '-'}</span>
                </div>
                <div className="signature-summary__item">
                  <strong>确认</strong>
                  <span>{`${card.confirmedBy || ''} ${card.confirmedDate || ''}`.trim() || '-'}</span>
                </div>
                <div className="signature-summary__item">
                  <strong>审核</strong>
                  <span>{`${card.reviewedBy || ''} ${card.reviewedDate || ''}`.trim() || '-'}</span>
                </div>
                <div className="signature-summary__item">
                  <strong>批准</strong>
                  <span>{`${card.approvedBy || ''} ${card.approvedDate || ''}`.trim() || '-'}</span>
                </div>
              </div>
            </div>

            <label className="field field--full">
              <span>最近退回意见</span>
              <textarea className="textarea--fixed" value={card.lastReturnComment || '-'} readOnly />
            </label>

            <label className="field field--full">
              <span>备注</span>
              <textarea className="textarea--fixed" value={FIXED_REMARK} readOnly />
            </label>
          </div>
        </section>
      ) : null}

      {!showApprovalPreview ? (
        <>
          <section className="panel panel--compact">
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

          <section className="panel panel--compact page-actions">
            <div className="page-actions__inner">
              <div>
                <h3>操作</h3>
                <p>编制和确认可编辑表单；审核和批准以打印版式审阅后直接审批。</p>
              </div>
              <div className="workflow-actions">
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
                  {card.id ? (
                    <Link to={`/cards/${card.id}/print`} className="button">
                      打印预览
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => void handleSaveWithPrompt()}
                      disabled={saving}
                    >
                      {saving ? '处理中...' : '保存工艺卡'}
                    </button>
                  ) : null}
                  {availableActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="button"
                      disabled={saving}
                      onClick={() => void handleWorkflowActionWithPrompt(action)}
                    >
                      {APPROVAL_ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="panel panel--compact page-actions">
          <div className="page-actions__inner">
            <div>
              <h3>审阅审批</h3>
              <p>审核和批准请在预览页直接查看 PDF 版式、填写意见并完成审批。</p>
            </div>
            <div className="toolbar">
              {card.id ? (
                <Link to={`/cards/${card.id}/print`} className="button button--primary">
                  进入预览审批页
                </Link>
              ) : null}
              <Link to="/" className="button button--ghost">
                返回列表
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
