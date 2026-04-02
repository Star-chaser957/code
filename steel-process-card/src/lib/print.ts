import type {
  CardOperation,
  OperationDefinition,
  OperationDetail,
  OperationFieldDefinition,
  ProcessCardPayload,
} from '../../shared/types';

const filledMark = '■';
const emptyMark = '□';

function isFieldVisible(field: OperationFieldDefinition, detail: OperationDetail) {
  if (field.showForDetailTypes && !field.showForDetailTypes.includes(detail.detailType)) {
    return false;
  }

  if (field.hideForDetailTypes?.includes(detail.detailType)) {
    return false;
  }

  return true;
}

const compactFieldText = (
  fields: OperationFieldDefinition[],
  params: Record<string, string>,
  detailType = '',
) =>
  fields
    .filter((field) => isFieldVisible(field, { detailSeq: 0, detailType, params }))
    .map((field) => {
      const value = params[field.key]?.trim();
      return value ? `${field.label}：${value}` : '';
    })
    .filter(Boolean);

export const getSelectedOptionLabels = (definition: OperationDefinition, operation: CardOperation) =>
  definition.optionCatalog
    .filter((option) => operation.selectedOptionCodes.includes(option.optionCode))
    .map((option) => option.label);

export const buildPrintCells = (definition: OperationDefinition, operation: CardOperation) => {
  if (definition.detailMode === 'multiple') {
    const chosenTypes = operation.details.map((detail) => detail.detailType);

    return {
      checkedName: `${filledMark}${definition.name}`,
      processLines: definition.optionCatalog.map(
        (option) => `${chosenTypes.includes(option.label) ? filledMark : emptyMark}${option.label}`,
      ),
      qualityLines: operation.details.map((detail) => {
        const summary = compactFieldText(definition.fieldConfig, detail.params, detail.detailType).join(' / ');
        return summary ? `${detail.detailType}：${summary}` : `${detail.detailType}`;
      }),
    };
  }

  if (definition.detailMode === 'checklist') {
    return {
      checkedName: `${filledMark}${definition.name}`,
      processLines: definition.optionCatalog.map(
        (option) =>
          `${operation.selectedOptionCodes.includes(option.optionCode) ? filledMark : emptyMark}${option.label}`,
      ),
      qualityLines: [],
    };
  }

  if (definition.detailMode === 'multiSelect') {
    return {
      checkedName: `${filledMark}${definition.name}`,
      processLines: definition.optionCatalog.map(
        (option) =>
          `${operation.selectedOptionCodes.includes(option.optionCode) ? filledMark : emptyMark}${option.label}`,
      ),
      qualityLines: operation.details.flatMap((detail) =>
        compactFieldText(definition.fieldConfig, detail.params, detail.detailType),
      ),
    };
  }

  const selected = getSelectedOptionLabels(definition, operation);

  return {
    checkedName: `${filledMark}${definition.name}`,
    processLines:
      definition.optionCatalog.length > 0
        ? definition.optionCatalog.map(
            (option) => `${selected.includes(option.label) ? filledMark : emptyMark}${option.label}`,
          )
        : ['/'],
    qualityLines: operation.details.flatMap((detail) =>
      compactFieldText(definition.fieldConfig, detail.params, detail.detailType),
    ),
  };
};

export const getPackagingOperation = (card: ProcessCardPayload) =>
  card.operations.find((item) => item.operationCode === 'packaging' && item.enabled);
