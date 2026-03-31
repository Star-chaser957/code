import { createEmptyDetail } from '../../shared/process-catalog';
import { DEPARTMENT_OPTIONS } from '../../shared/types';
import type { CardOperation, OperationDefinition, OperationDetail } from '../../shared/types';

type OperationEditorProps = {
  definition: OperationDefinition;
  operation: CardOperation;
  onToggleEnabled: () => void;
  onChange: (updater: (current: CardOperation) => CardOperation) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
};

function DetailFields({
  definition,
  detail,
  onChange,
}: {
  definition: OperationDefinition;
  detail: OperationDetail;
  onChange: (detail: OperationDetail) => void;
}) {
  return (
    <div className="detail-grid">
      {definition.detailMode === 'multiple' ? (
        <label className="field">
          <span>类型</span>
          <select
            value={detail.detailType}
            onChange={(event) => onChange({ ...detail, detailType: event.target.value })}
          >
            {definition.optionCatalog.map((option) => (
              <option key={option.optionCode} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {definition.fieldConfig.map((field) => (
        <label className="field" key={`${detail.detailSeq}-${field.key}`}>
          <span>{field.label}</span>
          <input
            value={detail.params[field.key] ?? ''}
            placeholder={field.placeholder ?? `请输入${field.label}`}
            onChange={(event) =>
              onChange({
                ...detail,
                params: {
                  ...detail.params,
                  [field.key]: event.target.value,
                },
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

export function OperationEditor({
  definition,
  operation,
  onToggleEnabled,
  onChange,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: OperationEditorProps) {
  const selectedOptionCodes = new Set(operation.selectedOptionCodes);
  const departmentListId = `department-options-${definition.code}`;

  return (
    <section className={`operation-card ${operation.enabled ? 'is-enabled' : ''}`}>
      <header className="operation-card__header">
        <div>
          <p className="operation-card__code">{definition.code}</p>
          <h3>{definition.name}</h3>
        </div>

        <div className="operation-card__actions">
          <button type="button" className="button button--ghost" onClick={onMoveUp} disabled={disableMoveUp}>
            上移
          </button>
          <button type="button" className="button button--ghost" onClick={onMoveDown} disabled={disableMoveDown}>
            下移
          </button>
          <button type="button" className="button" onClick={onToggleEnabled}>
            {operation.enabled ? '已启用' : '未启用'}
          </button>
        </div>
      </header>

      {!operation.enabled ? (
        <div className="operation-card__placeholder">
          <span>该工序当前未启用，点击右上角可快速加入本工艺卡。</span>
        </div>
      ) : (
        <>
          <div className="panel-grid">
            <label className="field">
              <span>生产部门</span>
              <input
                list={departmentListId}
                value={operation.department}
                placeholder="可选择，也可手动输入"
                onChange={(event) => onChange((current) => ({ ...current, department: event.target.value }))}
              />
              <datalist id={departmentListId}>
                {DEPARTMENT_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span>特殊特性</span>
              <input
                value={operation.specialCharacteristic}
                placeholder="如 S / ■ / △"
                onChange={(event) =>
                  onChange((current) => ({ ...current, specialCharacteristic: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>交付时间</span>
              <input
                type="date"
                value={operation.deliveryTime}
                onChange={(event) => onChange((current) => ({ ...current, deliveryTime: event.target.value }))}
              />
            </label>
          </div>

          {definition.optionCatalog.length > 0 ? (
            <div className="option-group">
              <p>{definition.detailMode === 'multiple' ? '可选处理类型' : '工艺/制造方式'}</p>
              <div className="chip-grid">
                {definition.optionCatalog.map((option) => {
                  const checked =
                    definition.detailMode === 'multiple'
                      ? operation.details.some((detail) => detail.detailType === option.label)
                      : selectedOptionCodes.has(option.optionCode);

                  const toggle = () => {
                    if (definition.detailMode === 'multiple') {
                      return;
                    }

                    onChange((current) => {
                      const next = new Set(current.selectedOptionCodes);
                      if (definition.detailMode === 'single') {
                        next.clear();
                      }
                      if (next.has(option.optionCode)) {
                        next.delete(option.optionCode);
                      } else {
                        next.add(option.optionCode);
                      }
                      return {
                        ...current,
                        selectedOptionCodes: Array.from(next),
                      };
                    });
                  };

                  return (
                    <label className={`chip ${checked ? 'is-active' : ''}`} key={option.optionCode}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={definition.detailMode === 'multiple'}
                        onChange={toggle}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {definition.detailMode === 'checklist' ? (
            <div className="operation-card__placeholder">
              <span>该工序使用多选项目结构化保存，打印时会按勾选项展示。</span>
            </div>
          ) : null}

          {definition.detailMode !== 'checklist' ? (
            <div className="detail-section">
              <div className="detail-section__header">
                <h4>{definition.detailLabel}</h4>
                {definition.detailMode === 'multiple' ? (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        details: [...current.details, createEmptyDetail(definition, current.details.length + 1)],
                      }))
                    }
                  >
                    新增一条明细
                  </button>
                ) : null}
              </div>

              <div className="detail-stack">
                {operation.details.map((detail, index) => (
                  <div className="detail-card" key={`${definition.code}-${detail.detailSeq}-${index}`}>
                    {definition.detailMode === 'multiple' ? (
                      <div className="detail-card__toolbar">
                        <strong>明细 {index + 1}</strong>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              details: current.details
                                .filter((_, currentIndex) => currentIndex !== index)
                                .map((item, nextIndex) => ({ ...item, detailSeq: nextIndex + 1 })),
                            }))
                          }
                          disabled={operation.details.length === 1}
                        >
                          删除
                        </button>
                      </div>
                    ) : null}

                    <DetailFields
                      definition={definition}
                      detail={detail}
                      onChange={(nextDetail) =>
                        onChange((current) => ({
                          ...current,
                          details: current.details.map((item, itemIndex) =>
                            itemIndex === index ? nextDetail : item,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="field field--full">
            <span>其他要求</span>
            <textarea
              className="textarea--large"
              value={operation.otherRequirements}
              onChange={(event) =>
                onChange((current) => ({ ...current, otherRequirements: event.target.value }))
              }
            />
          </label>
        </>
      )}
    </section>
  );
}
