import { CARD_STATUS_LABELS, FIXED_REMARK } from '../../shared/types';
import type { OperationDefinition, ProcessCardPayload } from '../../shared/types';
import { buildPrintCells, getPackagingOperation } from '../lib/print';

type PrintTemplateProps = {
  card: ProcessCardPayload;
  definitions: OperationDefinition[];
  logoSrc?: string;
};

function withUnit(value: string, unit: 'mm' | 'kg') {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const unitPattern = unit === 'mm' ? /(mm|毫米)/i : /(kg|千克|公斤)/i;
  return unitPattern.test(trimmed) ? trimmed : `${trimmed}${unit}`;
}

export function PrintTemplate({
  card,
  definitions,
  logoSrc = '/logo.png',
}: PrintTemplateProps) {
  const isCustomOperationCode = (code: string) => code.startsWith('custom-operation');
  const packaging = getPackagingOperation(card);
  const packagingParams = packaging?.details[0]?.params ?? {};
  const enabledDefinitions = definitions.filter((definition) => {
    if (definition.code === 'packaging') {
      return false;
    }

    return card.operations.some(
      (operation) => operation.operationCode === definition.code && operation.enabled,
    );
  });

  return (
    <div className="print-page">
      <header className="print-header">
        <div className="print-brand">
          <img src={logoSrc} alt="Steel Process Card" />
          <span>XH/D-03068</span>
        </div>
        <div className="print-title">
          <h1>生产工艺卡</h1>
          <span>{CARD_STATUS_LABELS[card.status]}</span>
        </div>
        <div className="print-header__spacer" aria-hidden="true" />
      </header>

      <table className="print-meta">
        <colgroup>
          <col className="meta-col-label" />
          <col className="meta-col-value" />
          <col className="meta-col-label meta-col-label--wide" />
          <col className="meta-col-value" />
          <col className="meta-col-label meta-col-label--compact" />
          <col className="meta-col-value" />
        </colgroup>
        <tbody>
          <tr>
            <th>计划单号</th>
            <td>{card.planNumber}</td>
            <th>客户代码</th>
            <td>{card.customerCode}</td>
            <th>接单日期</th>
            <td>{card.orderDate}</td>
          </tr>
          <tr>
            <th>产品名称</th>
            <td>{card.productName}</td>
            <th>规格及公差（mm）</th>
            <td>{withUnit(card.specification, 'mm')}</td>
            <th>交付日期</th>
            <td>{card.deliveryDate}</td>
          </tr>
          <tr>
            <th>材质</th>
            <td>{card.material}</td>
            <th>长度及公差（mm）</th>
            <td>{withUnit(card.lengthTolerance, 'mm')}</td>
            <th>数量（kg）</th>
            <td>{withUnit(card.quantity, 'kg')}</td>
          </tr>
          <tr>
            <th>交货状态</th>
            <td colSpan={5}>{card.deliveryStatus}</td>
          </tr>
          <tr>
            <th>执行标准</th>
            <td colSpan={5}>{card.standard}</td>
          </tr>
          <tr>
            <th>技术要求</th>
            <td colSpan={5}>{card.technicalRequirements}</td>
          </tr>
        </tbody>
      </table>

      <table className="print-process">
        <thead>
          <tr>
            <th className="col-process-name">工序</th>
            <th className="col-department">生产部门</th>
            <th className="col-special">特殊特性</th>
            <th className="col-method">工艺/制造</th>
            <th className="col-quality">产品要求</th>
            <th className="col-delivery">交付时间</th>
            <th className="col-other">其他要求</th>
          </tr>
        </thead>
        <tbody>
          {enabledDefinitions.map((definition) => {
            const operation = card.operations.find(
              (item) => item.operationCode === definition.code && item.enabled,
            );

            if (!operation) {
              return null;
            }

            const cells = buildPrintCells(definition, operation);

            return (
              <tr key={definition.code}>
                <td>
                  <strong>{cells.checkedName}</strong>
                </td>
                <td>{operation.department}</td>
                {isCustomOperationCode(definition.code) ? (
                  <td colSpan={3}>
                    {cells.qualityLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </td>
                ) : (
                  <>
                    <td>{operation.specialCharacteristic}</td>
                    <td>
                      {cells.processLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </td>
                    <td>
                      {cells.qualityLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </td>
                  </>
                )}
                <td>{operation.deliveryTime}</td>
                <td>{isCustomOperationCode(definition.code) ? '' : operation.otherRequirements}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="print-footer">
        <tbody>
          {packaging ? (
            <tr>
              <th>包装</th>
              <td>■包装</td>
              <th>包装方式</th>
              <td>{packagingParams.packagingMethod ?? ''}</td>
              <th>防护要求</th>
              <td>{packagingParams.protectionRequirement ?? ''}</td>
              <th>包装质量</th>
              <td>{packagingParams.packageQuality ?? ''}</td>
            </tr>
          ) : null}
          <tr>
            <th>编制/日期</th>
            <td colSpan={2}>
              {card.preparedBy} {card.preparedDate}
            </td>
            <th>确认/日期</th>
            <td colSpan={2}>
              {card.confirmedBy} {card.confirmedDate}
            </td>
            <th>审核/日期</th>
            <td>
              {card.reviewedBy} {card.reviewedDate}
            </td>
          </tr>
          <tr>
            <th>批准/日期</th>
            <td colSpan={2}>
              {card.approvedBy} {card.approvedDate}
            </td>
            <th>备注</th>
            <td colSpan={4}>{FIXED_REMARK}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
