import { createEmptyDetail } from '../../shared/process-catalog';
import type {
  CardOperation,
  DepartmentOption,
  OperationDefinition,
  OperationDetail,
  OperationFieldDefinition,
} from '../../shared/types';

type OperationEditorProps = {
  definition: OperationDefinition;
  operation: CardOperation;
  departmentOptions: DepartmentOption[];
  readOnly?: boolean;
  onToggleEnabled: () => void;
  onChange: (updater: (current: CardOperation) => CardOperation) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
};

const SPECIAL_CHARACTERISTIC_OPTIONS = ['', '△', 'S', '■'];

function getVisibleFields(definition: OperationDefinition, detail: OperationDetail) {
  return definition.fieldConfig.filter((field) => {
    if (field.showForDetailTypes && !field.showForDetailTypes.includes(detail.detailType)) {
      return false;
    }

    if (field.hideForDetailTypes?.includes(detail.detailType)) {
      return false;
    }

    return true;
  });
}

function renderFieldInput(
  field: OperationFieldDefinition,
  detail: OperationDetail,
  disabled: boolean,
  onChange: (detail: OperationDetail) => void,
) {
  const value = detail.params[field.key] ?? '';
  const placeholder = field.placeholder ?? `请输入${field.label}`;

  const updateValue = (nextValue: string) =>
    onChange({
      ...detail,
      params: {
        ...detail.params,
        [field.key]: nextValue,
      },
    });

  if (field.inputType === 'select') {
    return (
      <select value={value} disabled={disabled} onChange={(event) => updateValue(event.target.value)}>
        <option value="">请选择</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.inputType === 'textarea') {
    return (
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  }

  return (
    <input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => updateValue(event.target.value)}
    />
  );
}

function DetailFields({
  definition,
  detail,
  disabled,
  onChange,
}: {
  definition: OperationDefinition;
  detail: OperationDetail;
  disabled: boolean;
  onChange: (detail: OperationDetail) => void;
}) {
  const visibleFields = getVisibleFields(definition, detail);

  return (
    <div className="detail-grid">
      {visibleFields.map((field) => (
        <label className="field" key={`${detail.detailSeq}-${field.key}`}>
          <span>{field.label}</span>
          {renderFieldInput(field, detail, disabled, onChange)}
        </label>
      ))}
    </div>
  );
}

function toggleSteelmakingOption(current: CardOperation, definition: OperationDefinition, optionCode: string) {
  const primaryCodes = definition.optionCatalog.slice(0, 3).map((item) => item.optionCode);
  const slagCode = definition.optionCatalog[3]?.optionCode;
  const next = new Set(current.selectedOptionCodes);

  if (primaryCodes.includes(optionCode)) {
    const hadSelectedPrimary = next.has(optionCode);
    const hadSlag = slagCode ? next.has(slagCode) : false;
    primaryCodes.forEach((code) => next.delete(code));

    if (!hadSelectedPrimary) {
      next.add(optionCode);
    }

    if (hadSlag && slagCode) {
      next.add(slagCode);
    }

    return Array.from(next);
  }

  if (slagCode && optionCode === slagCode) {
    if (next.has(optionCode)) {
      next.delete(optionCode);
      return Array.from(next);
    }

    next.add(optionCode);
    if (!primaryCodes.some((code) => next.has(code))) {
      next.add(primaryCodes[0]);
    }
  }

  return Array.from(next);
}

export function OperationEditor({
  definition,
  operation,
  departmentOptions,
  readOnly = false,
  onToggleEnabled,
  onChange,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: OperationEditorProps) {
  const selectedOptionCodes = new Set(operation.selectedOptionCodes);
  const departmentListId = `department-options-${definition.code}`;
  const isHeatTreatment = definition.code === 'heat-treatment';

  return (
    <section className="operation-card is-enabled">
      <header className="operation-card__header">
        <div>
          <p className="operation-card__code">{definition.code}</p>
          <h3>{definition.name}</h3>
        </div>

        <div className="operation-card__actions">
          <button type="button" className="button button--ghost" onClick={onMoveUp} disabled={readOnly || disableMoveUp}>
            上移
          </button>
          <button type="button" className="button button--ghost" onClick={onMoveDown} disabled={readOnly || disableMoveDown}>
            下移
          </button>
          <button type="button" className="button" onClick={onToggleEnabled} disabled={readOnly}>
            已启用
          </button>
        </div>
      </header>

      <div className="panel-grid">
        <label className="field">
          <span>生产部门</span>
          <input
            list={departmentListId}
            value={operation.department}
            disabled={readOnly}
            placeholder="可选择，也可手动输入"
            onChange={(event) => onChange((current) => ({ ...current, department: event.target.value }))}
          />
          <datalist id={departmentListId}>
            {departmentOptions.map((option) => (
              <option key={option.id} value={option.label} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>特殊特性</span>
          <select
            value={operation.specialCharacteristic}
            disabled={readOnly}
            onChange={(event) =>
              onChange((current) => ({ ...current, specialCharacteristic: event.target.value }))
            }
          >
            {SPECIAL_CHARACTERISTIC_OPTIONS.map((option) => (
              <option key={option || 'blank'} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>交付时间</span>
          <input
            type="date"
            value={operation.deliveryTime}
            disabled={readOnly}
            onChange={(event) => onChange((current) => ({ ...current, deliveryTime: event.target.value }))}
          />
        </label>
      </div>

      {definition.optionCatalog.length > 0 ? (
        <div className="option-group">
          <p>{isHeatTreatment ? '处理类型' : '工艺/制造方式'}</p>

          {isHeatTreatment ? (
            <div className="chip-grid chip-grid--toolbar">
              {definition.optionCatalog.map((option) => {
                const checked = operation.details.some((detail) => detail.detailType === option.label);

                return (
                  <button
                    type="button"
                    key={option.optionCode}
                    disabled={readOnly}
                    className={`chip-button ${checked ? 'is-active' : ''}`}
                    onClick={() =>
                      onChange((current) => {
                        const exists = current.details.some((detail) => detail.detailType === option.label);
                        const nextDetails = exists
                          ? current.details.filter((detail) => detail.detailType !== option.label)
                          : [
                              ...current.details,
                              createEmptyDetail(definition, current.details.length + 1, option.label),
                            ];

                        const orderedDetails = definition.optionCatalog
                          .map((catalogOption) =>
                            nextDetails.find((detail) => detail.detailType === catalogOption.label),
                          )
                          .filter((detail): detail is OperationDetail => Boolean(detail))
                          .map((detail, index) => ({ ...detail, detailSeq: index + 1 }));

                        return {
                          ...current,
                          details: orderedDetails,
                        };
                      })
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="chip-grid">
              {definition.optionCatalog.map((option) => {
                const checked = selectedOptionCodes.has(option.optionCode);

                return (
                  <label className={`chip ${checked ? 'is-active' : ''}`} key={option.optionCode}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly}
                      onChange={() =>
                        onChange((current) => {
                          if (definition.code === 'steelmaking') {
                            return {
                              ...current,
                              selectedOptionCodes: toggleSteelmakingOption(current, definition, option.optionCode),
                            };
                          }

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
                        })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {definition.code === 'steelmaking' ? (
            <div className="operation-card__placeholder">
              选择“电渣”时，会自动保留前三项中的一项；产品要求只填写一套。
            </div>
          ) : null}
        </div>
      ) : null}

      {definition.detailMode === 'checklist' ? (
        <div className="operation-card__placeholder">该工序使用多选项目结构化保存，打印时按勾选项目展示。</div>
      ) : null}

      {definition.detailMode !== 'checklist' ? (
        <div className="detail-section">
          <div className="detail-section__header">
            <h4>{definition.detailLabel}</h4>
          </div>

          <div className="detail-stack">
            {operation.details.length === 0 ? (
              <div className="operation-card__placeholder">
                {isHeatTreatment ? '请先选择处理类型，再填写对应明细。' : '请填写该工序的产品要求。'}
              </div>
            ) : null}

            {operation.details.map((detail, index) => (
              <div className="detail-card" key={`${definition.code}-${detail.detailSeq}-${index}`}>
                {definition.detailMode === 'multiple' ? (
                  <div className="detail-card__toolbar">
                    <strong>{detail.detailType || `明细 ${index + 1}`}</strong>
                  </div>
                ) : null}

                <DetailFields
                  definition={definition}
                  detail={detail}
                  disabled={readOnly}
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
          disabled={readOnly}
          onChange={(event) => onChange((current) => ({ ...current, otherRequirements: event.target.value }))}
        />
      </label>
    </section>
  );
}
