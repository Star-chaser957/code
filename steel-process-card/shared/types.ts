export type DetailMode = 'single' | 'multiple' | 'multiSelect' | 'checklist';

export type OperationFieldDefinition = {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
  inputType?: 'text' | 'select' | 'textarea';
  options?: string[];
  showForDetailTypes?: string[];
  hideForDetailTypes?: string[];
};

export type OperationOptionDefinition = {
  operationCode: string;
  optionCode: string;
  label: string;
  sortOrder: number;
};

export type OperationDefinition = {
  code: string;
  name: string;
  defaultOrder: number;
  detailMode: DetailMode;
  allowsMultipleDetails: boolean;
  detailLabel: string;
  fieldConfig: OperationFieldDefinition[];
  optionCatalog: OperationOptionDefinition[];
};

export type OperationDetail = {
  id?: string;
  detailSeq: number;
  detailType: string;
  displayText?: string;
  params: Record<string, string>;
};

export type CardOperation = {
  id?: string;
  operationCode: string;
  sortOrder: number;
  enabled: boolean;
  department: string;
  specialCharacteristic: string;
  deliveryTime: string;
  otherRequirements: string;
  remark: string;
  selectedOptionCodes: string[];
  details: OperationDetail[];
};

export type ProcessCardPayload = {
  id?: string;
  cardNo: string;
  planNumber: string;
  customerCode: string;
  orderDate: string;
  productName: string;
  material: string;
  specification: string;
  quantity: string;
  deliveryDate: string;
  deliveryStatus: string;
  standard: string;
  technicalRequirements: string;
  remark: string;
  preparedBy: string;
  preparedDate: string;
  confirmedBy: string;
  confirmedDate: string;
  reviewedBy: string;
  reviewedDate: string;
  approvedBy: string;
  approvedDate: string;
  createdAt?: string;
  updatedAt?: string;
  operations: CardOperation[];
};

export type ProcessCardListFilters = {
  keyword?: string;
  planNumber?: string;
  customerCode?: string;
  productName?: string;
  material?: string;
  specification?: string;
  deliveryDate?: string;
  operationCode?: string;
  heatTreatmentType?: string;
};

export type ProcessCardListItem = {
  id: string;
  cardNo: string;
  planNumber: string;
  customerCode: string;
  productName: string;
  material: string;
  specification: string;
  deliveryDate: string;
  updatedAt: string;
  enabledOperationCodes: string[];
  heatTreatmentTypes: string[];
};

export type DepartmentOption = {
  id: string;
  label: string;
  sortOrder: number;
};

export type BatchExportRequest = {
  ids: string[];
};

export type ProductPrefillCandidate = {
  sourceCardId: string;
  productName: string;
  planNumber: string;
  updatedAt: string;
  operations: CardOperation[];
};

export type UserRole = 'admin' | 'user';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const FIXED_REMARK =
  '适用于钢棒生产。特性符号：关键特性S，重要特性■，过程特性△。';

export const DEFAULT_DEPARTMENT_OPTIONS = [
  '炼钢车间',
  '轧钢车间',
  '锻造车间',
  '热处理',
  '精整',
  '质检',
  '包装',
];

export const MAIN_INFO_FIELDS: Array<{
  key: keyof ProcessCardPayload;
  label: string;
  type?: 'date' | 'textarea';
  large?: boolean;
}> = [
  { key: 'planNumber', label: '计划单号' },
  { key: 'customerCode', label: '客户代码' },
  { key: 'productName', label: '产品名称' },
  { key: 'orderDate', label: '接单日期', type: 'date' },
  { key: 'material', label: '材质' },
  { key: 'specification', label: '规格' },
  { key: 'quantity', label: '数量' },
  { key: 'deliveryDate', label: '交付日期', type: 'date' },
  { key: 'deliveryStatus', label: '交货状态' },
  { key: 'standard', label: '执行标准', type: 'textarea', large: true },
  { key: 'technicalRequirements', label: '技术要求', type: 'textarea' },
];

export const SIGNATURE_FIELDS: Array<{
  key: keyof ProcessCardPayload;
  label: string;
  type?: 'date';
}> = [
  { key: 'preparedBy', label: '编制' },
  { key: 'preparedDate', label: '编制日期', type: 'date' },
  { key: 'confirmedBy', label: '确认' },
  { key: 'confirmedDate', label: '确认日期', type: 'date' },
  { key: 'reviewedBy', label: '审核' },
  { key: 'reviewedDate', label: '审核日期', type: 'date' },
  { key: 'approvedBy', label: '批准' },
  { key: 'approvedDate', label: '批准日期', type: 'date' },
];
