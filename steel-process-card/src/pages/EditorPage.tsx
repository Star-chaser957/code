import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEmptyProcessCard } from '../../shared/process-catalog';
import type {
  CardOperation,
  DepartmentOption,
  OperationDefinition,
  ProcessCardPayload,
} from '../../shared/types';
import { FIXED_REMARK, MAIN_INFO_FIELDS, SIGNATURE_FIELDS } from '../../shared/types';
import { OperationEditor } from '../components/OperationEditor';
import { api } from '../lib/api';

function sortOperations(operations: CardOperation[]) {
  return [...operations].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function EditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [card, setCard] = useState<ProcessCardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [definitionResponse, departmentResponse] = await Promise.all([
          api.getOperationDefinitions(),
          api.getDepartmentOptions(),
        ]);
        setDefinitions(definitionResponse.items);
        setDepartmentOptions(departmentResponse.items);

        if (id) {
          const detail = await api.getProcessCard(id);
          setCard({ ...detail, remark: FIXED_REMARK });
        } else {
          setCard(createEmptyProcessCard(definitionResponse.items));
        }

        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const enabledOperations = useMemo(
    () => sortOperations((card?.operations ?? []).filter((item) => item.enabled)),
    [card],
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

  const handleSave = async () => {
    if (!card) {
      return;
    }

    setSaving(true);
    try {
      const payload = { ...card, remark: FIXED_REMARK };
      const saved =
        isEditMode && id ? await api.updateProcessCard(id, payload) : await api.createProcessCard(payload);
      setCard({ ...saved, remark: FIXED_REMARK });
      setMessage('工艺卡已保存。');
      setError('');

      if (!isEditMode) {
        navigate(`/cards/${saved.id}/edit`, { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !card) {
    return (
      <div className="page">
        <div className="state">正在加载工艺卡...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Card Editor</p>
          <h2>{isEditMode ? '编辑工艺卡' : '新建工艺卡'}</h2>
          <p>录入页按“主信息 → 工序卡片 → 签字备注”组织，填写更快，打印另做版式。</p>
        </div>
        <div className="toolbar">
          {card.id ? (
            <Link to={`/cards/${card.id}/print`} className="button">
              打印预览
            </Link>
          ) : null}
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存工艺卡'}
          </button>
        </div>
      </header>

      {message ? <div className="state">{message}</div> : null}
      {error ? <div className="state state--error">{error}</div> : null}

      <section className="panel">
        <div className="panel__header">
          <h3>主信息</h3>
        </div>
        <div className="form-grid">
          {MAIN_INFO_FIELDS.map((field) => (
            <label
              key={field.key}
              className={`field ${field.type === 'textarea' ? 'field--full' : ''}`}
            >
              <span>{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea
                  className={field.large ? 'textarea--large' : undefined}
                  value={card[field.key] as string}
                  onChange={(event) =>
                    setCard((current) => current && { ...current, [field.key]: event.target.value })
                  }
                />
              ) : (
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={card[field.key] as string}
                  onChange={(event) =>
                    setCard((current) => current && { ...current, [field.key]: event.target.value })
                  }
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>工序启用</h3>
          <span>点选启用后，下方卡片立即可编辑。</span>
        </div>
        <div className="chip-grid chip-grid--toolbar">
          {definitions.map((definition) => {
            const operation = card.operations.find((item) => item.operationCode === definition.code);
            const enabled = operation?.enabled ?? false;

            return (
              <button
                type="button"
                key={definition.code}
                className={`chip-button ${enabled ? 'is-active' : ''}`}
                onClick={() => toggleOperation(definition.code)}
              >
                {definition.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        {enabledOperations.length === 0 ? (
          <div className="state">请先在上方选择需要启用的工序，已启用工序会显示在这里供你填写。</div>
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

      <section className="panel">
        <div className="panel__header">
          <h3>签字与备注</h3>
        </div>
        <div className="form-grid">
          {SIGNATURE_FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              <input
                type={field.type === 'date' ? 'date' : 'text'}
                value={card[field.key] as string}
                onChange={(event) =>
                  setCard((current) => current && { ...current, [field.key]: event.target.value })
                }
              />
            </label>
          ))}
          <label className="field field--full">
            <span>备注</span>
            <textarea className="textarea--fixed" value={FIXED_REMARK} readOnly />
          </label>
        </div>
      </section>
    </div>
  );
}
