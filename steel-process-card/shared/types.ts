export type DetailMode = 'single' | 'multiple' | 'multiSelect' | 'checklist';

export type WorkflowRole = 'prepare' | 'confirm' | 'review' | 'approve';

export type UserRole = 'admin' | 'user';

export type CardWorkflowStatus =
  | 'draft'
  | 'pending_confirm'
  | 'pending_review'
  | 'pending_approve'
  | 'approved'
  | 'voided'
  | 'rejected_to_prepare'
  | 'rejected_to_confirm'
  | 'rejected_to_review';

export type WorkflowStep = 'prepare' | 'confirm' | 'review' | 'approve';

export type ApprovalAction =
  | 'submit_confirm'
  | 'return_prepare'
  | 'submit_review'
  | 'reject_to_prepare'
  | 'reject_to_confirm'
  | 'submit_approve'
  | 'reject_to_review'
  | 'approve';

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

export type ApprovalLog = {
  id: string;
  action: ApprovalAction;
  fromStatus: CardWorkflowStatus;
  toStatus: CardWorkflowStatus;
  actorUserId: string;
  actorUsername: string;
  actorDisplayName: string;
  targetUserId: string;
  targetDisplayName: string;
  comment: string;
  createdAt: string;
};

export type CardPermissions = {
  canEdit: boolean;
  canDelete: boolean;
  availableActions: ApprovalAction[];
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
  status: CardWorkflowStatus;
  currentStep: WorkflowStep;
  currentHandlerUserId: string;
  currentHandlerName: string;
  createdByUserId: string;
  createdByName: string;
  confirmedUserId: string;
  reviewedUserId: string;
  approvedUserId: string;
  versionNo: number;
  sourceCardId: string;
  submittedAt: string;
  lockedAt: string;
  lastReturnComment: string;
  approvalLogs: ApprovalLog[];
  permissions: CardPermissions;
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
  status?: CardWorkflowStatus | '';
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
  status: CardWorkflowStatus;
  currentStep: WorkflowStep;
  currentHandlerName: string;
  versionNo: number;
  lastReturnComment: string;
  enabledOperationCodes: string[];
  heatTreatmentTypes: string[];
  permissions: Pick<CardPermissions, 'canEdit' | 'canDelete'>;
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

export type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  workflowRoles: WorkflowRole[];
  isActive: boolean;
};

export type AuthUser = UserSummary;

export type UserAccount = UserSummary & {
  createdAt: string;
  updatedAt: string;
};

export type UserAccountCreateRequest = {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  workflowRoles: WorkflowRole[];
  isActive: boolean;
};

export type UserAccountUpdateRequest = {
  displayName: string;
  role: UserRole;
  workflowRoles: WorkflowRole[];
};

export type UserPasswordResetRequest = {
  password: string;
};

export type UserActiveToggleRequest = {
  isActive: boolean;
};

export type AuditLogCategory = 'auth' | 'process_card' | 'approval' | 'dictionary' | 'user';

export type AuditLogChange = {
  field: string;
  before: string;
  after: string;
};

export type AuditLogEntry = {
  id: string;
  category: AuditLogCategory;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  actorDisplayName: string;
  targetUserId: string;
  targetDisplayName: string;
  summary: string;
  detailText: string;
  changes: AuditLogChange[];
  ipAddress: string;
  createdAt: string;
};

export type AuditLogFilters = {
  category?: AuditLogCategory | '';
  actorUserId?: string;
  keyword?: string;
};

export type DashboardTaskSummary = {
  draftCount: number;
  pendingConfirmCount: number;
  pendingReviewCount: number;
  pendingApproveCount: number;
  returnedCount: number;
  totalPendingCount: number;
};

export type DashboardStatSummary = {
  todayCreated: number;
  weekCreated: number;
  monthCreated: number;
  yearCreated: number;
  approvedCount: number;
  voidedCount: number;
};

export type DashboardTrendPoint = {
  label: string;
  value: number;
};

export type DashboardDistributionItem = {
  label: string;
  value: number;
};

export type DashboardActivityItem = {
  id: string;
  category: AuditLogCategory;
  entityId: string;
  title: string;
  actorDisplayName: string;
  createdAt: string;
  statusLabel: string;
};

export type NotificationLevel = 'todo' | 'warning' | 'info' | 'success';

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  level: NotificationLevel;
  actionLabel: string;
  to: string;
};

export type NotificationOverview = {
  totalCount: number;
  todoCount: number;
  items: NotificationItem[];
};

export type DashboardOverview = {
  tasks: DashboardTaskSummary;
  stats: DashboardStatSummary;
  trend: DashboardTrendPoint[];
  statusDistribution: DashboardDistributionItem[];
  recentActivities: DashboardActivityItem[];
  notifications: NotificationItem[];
  notificationCount: number;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type ApprovalActionRequest = {
  action: ApprovalAction;
  comment?: string;
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

export const WORKFLOW_ROLE_LABELS: Record<WorkflowRole, string> = {
  prepare: '编制',
  confirm: '确认',
  review: '审核',
  approve: '批准',
};

export const CARD_STATUS_LABELS: Record<CardWorkflowStatus, string> = {
  draft: '草稿',
  pending_confirm: '待确认',
  pending_review: '待审核',
  pending_approve: '待批准',
  approved: '已批准',
  voided: '已作废',
  rejected_to_prepare: '退回编制',
  rejected_to_confirm: '退回确认',
  rejected_to_review: '退回审核',
};

export const APPROVAL_ACTION_LABELS: Record<ApprovalAction, string> = {
  submit_confirm: '提交确认',
  return_prepare: '退回编制',
  submit_review: '提交审核',
  reject_to_prepare: '驳回编制',
  reject_to_confirm: '驳回确认',
  submit_approve: '提交批准',
  reject_to_review: '退回审核',
  approve: '批准通过',
};

export const APPROVAL_ACTION_COMMENT_REQUIRED: ApprovalAction[] = [
  'return_prepare',
  'reject_to_prepare',
  'reject_to_confirm',
  'reject_to_review',
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
}> = [
  { key: 'preparedBy', label: '编制' },
  { key: 'preparedDate', label: '编制日期' },
  { key: 'confirmedBy', label: '确认' },
  { key: 'confirmedDate', label: '确认日期' },
  { key: 'reviewedBy', label: '审核' },
  { key: 'reviewedDate', label: '审核日期' },
  { key: 'approvedBy', label: '批准' },
  { key: 'approvedDate', label: '批准日期' },
];
