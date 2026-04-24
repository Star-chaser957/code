import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { z } from 'zod';
import { appConfig, projectRoot } from '../config';
import { createDatabaseClient } from './client';
import { createDemoProcessCard, createEmptyOperation, PROCESS_CATALOG } from '../../shared/process-catalog';
import type {
  ApprovalAction,
  ApprovalActionRequest,
  ApprovalLog,
  AuditLogChange,
  AuditLogCategory,
  AuditLogEntry,
  AuditLogFilters,
  AuthUser,
  BatchExportRequest,
  CardOperation,
  CardPermissions,
  CardWorkflowStatus,
  DashboardActivityItem,
  DashboardDistributionItem,
  DashboardOverview,
  DashboardStatSummary,
  DashboardTaskSummary,
  DashboardTrendPoint,
  DepartmentOption,
  LoginResponse,
  NotificationItem,
  NotificationOverview,
  OperationDefinition,
  OperationDetail,
  ProcessCardListFilters,
  ProcessCardListItem,
  ProcessCardPayload,
  ProductPrefillCandidate,
  UserRole,
  UserAccount,
  UserAccountCreateRequest,
  UserAccountUpdateRequest,
  UserSummary,
  UserPasswordResetRequest,
  WorkflowRole,
  WorkflowStep,
} from '../../shared/types';
import {
  APPROVAL_ACTION_COMMENT_REQUIRED,
  DEFAULT_DEPARTMENT_OPTIONS,
  FIXED_REMARK,
  MAIN_INFO_FIELDS,
} from '../../shared/types';

dayjs.extend(isoWeek);

const recordSchema = z.record(z.string(), z.string());

const processCardSchema = z.object({
  id: z.string().optional(),
  cardNo: z.string(),
  planNumber: z.string(),
  customerCode: z.string(),
  orderDate: z.string(),
  productName: z.string(),
  material: z.string(),
  specification: z.string(),
  lengthTolerance: z.string().optional().default(''),
  quantity: z.string(),
  deliveryDate: z.string(),
  deliveryStatus: z.string(),
  standard: z.string(),
  technicalRequirements: z.string(),
  remark: z.string(),
  preparedBy: z.string(),
  preparedDate: z.string(),
  confirmedBy: z.string(),
  confirmedDate: z.string(),
  reviewedBy: z.string(),
  reviewedDate: z.string(),
  approvedBy: z.string(),
  approvedDate: z.string(),
  confirmedUserId: z.string(),
  reviewedUserId: z.string(),
  approvedUserId: z.string(),
  sourceCardId: z.string().optional(),
  operations: z.array(
    z.object({
      id: z.string().optional(),
      operationCode: z.string(),
      sortOrder: z.number().int(),
      enabled: z.boolean(),
      customName: z.string().optional().default(''),
      department: z.string(),
      specialCharacteristic: z.string(),
      deliveryTime: z.string(),
      otherRequirements: z.string(),
      remark: z.string(),
      selectedOptionCodes: z.array(z.string()),
      details: z.array(
        z.object({
          id: z.string().optional(),
          detailSeq: z.number().int().nonnegative(),
          detailType: z.string(),
          displayText: z.string().optional(),
          params: recordSchema,
        }),
      ),
    }),
  ),
});

const departmentOptionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1),
  sortOrder: z.number().int().nonnegative(),
});

const departmentOptionListSchema = z.array(departmentOptionSchema);

const userAccountCreateSchema = z.object({
  username: z.string().trim().min(3),
  displayName: z.string().trim().min(1),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']),
  workflowRoles: z.array(z.enum(['prepare', 'confirm', 'review', 'approve'])),
  isActive: z.boolean().default(true),
});

const userAccountUpdateSchema = z.object({
  displayName: z.string().trim().min(1),
  role: z.enum(['admin', 'user']),
  workflowRoles: z.array(z.enum(['prepare', 'confirm', 'review', 'approve'])),
});

const userPasswordResetSchema = z.object({
  password: z.string().min(6),
});

const userActiveToggleSchema = z.object({
  isActive: z.boolean(),
});

const auditLogFiltersSchema = z.object({
  category: z.enum(['auth', 'process_card', 'approval', 'dictionary', 'user']).optional(),
  actorUserId: z.string().optional(),
  keyword: z.string().optional(),
});

const approvalActionSchema = z.object({
  action: z.enum([
    'submit_confirm',
    'return_prepare',
    'submit_review',
    'reject_to_prepare',
    'reject_to_confirm',
    'submit_approve',
    'reject_to_review',
    'approve',
  ]),
  comment: z.string().optional(),
});

const mainInfoFieldLabels = new Map(
  MAIN_INFO_FIELDS.map((field) => [field.key, field.label] as const),
);

const REQUIRED_MAIN_INFO_KEYS = ['planNumber', 'productName'] as const;

type CardRow = {
  id: string;
  card_no: string;
  plan_number: string;
  customer_code: string;
  order_date: string;
  product_name: string;
  material: string;
  specification: string;
  length_tolerance: string;
  quantity: string;
  delivery_date: string;
  delivery_status: string;
  standard: string;
  technical_requirements: string;
  remark: string;
  prepared_by: string;
  prepared_date: string;
  confirmed_by: string;
  confirmed_date: string;
  reviewed_by: string;
  reviewed_date: string;
  approved_by: string;
  approved_date: string;
  status: CardWorkflowStatus;
  current_step: WorkflowStep;
  current_handler_user_id: string;
  created_by_user_id: string;
  confirmed_user_id: string;
  reviewed_user_id: string;
  approved_user_id: string;
  submitted_at: string;
  locked_at: string;
  version_no: number;
  source_card_id: string;
  last_return_comment: string;
  created_at: string;
  updated_at: string;
};

type DefinitionRow = {
  code: string;
  name: string;
  default_order: number;
  detail_mode: OperationDefinition['detailMode'];
  allows_multiple_details: number;
  detail_label: string;
  field_config_json: string;
};

type OptionRow = {
  operation_code: string;
  option_code: string;
  label: string;
  sort_order: number;
};

type OperationRow = {
  id: string;
  operation_code: string;
  sort_order: number;
  enabled: number;
  custom_name: string;
  department: string;
  special_characteristic: string;
  delivery_time: string;
  other_requirements: string;
  remark: string;
};

type SelectedOptionRow = {
  card_operation_id: string;
  option_code: string;
};

type DetailRow = {
  id: string;
  card_operation_id: string;
  detail_seq: number;
  detail_type: string;
  display_text: string;
  params_json: string;
};

type DepartmentOptionRow = {
  id: string;
  label: string;
  sort_order: number;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash?: string;
  role: UserRole;
  is_active: number;
  workflow_roles?: string;
  created_at?: string;
  updated_at?: string;
};

type ApprovalLogRow = {
  id: string;
  action: ApprovalAction;
  from_status: CardWorkflowStatus;
  to_status: CardWorkflowStatus;
  actor_user_id: string;
  actor_username: string;
  actor_display_name: string;
  target_user_id: string;
  target_display_name: string;
  comment: string;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  category: AuditLogCategory;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string;
  actor_display_name: string;
  target_user_id: string;
  target_display_name: string;
  summary: string;
  detail_text: string;
  changes_json: string;
  ip_address: string;
  created_at: string;
};

type NotificationReadRow = {
  notification_id: string;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * appConfig.sessionTtlHours;
const WORKFLOW_ROLE_ORDER: WorkflowRole[] = ['prepare', 'confirm', 'review', 'approve'];

const csvToArray = (value?: string) =>
  value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];

const hasMeaningfulOperationContent = (operation: CardOperation) =>
  operation.enabled ||
  operation.selectedOptionCodes.length > 0 ||
  operation.details.some(
    (detail) =>
      detail.detailType.trim() ||
      Object.values(detail.params).some((value) => value.trim()),
  );

const toDefinition = (row: DefinitionRow, optionRows: OptionRow[]): OperationDefinition => ({
  code: row.code,
  name: row.name,
  defaultOrder: row.default_order,
  detailMode: row.detail_mode,
  allowsMultipleDetails: Boolean(row.allows_multiple_details),
  detailLabel: row.detail_label,
  fieldConfig: JSON.parse(row.field_config_json),
  optionCatalog: optionRows
    .filter((option) => option.operation_code === row.code)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((option) => ({
      operationCode: option.operation_code,
      optionCode: option.option_code,
      label: option.label,
      sortOrder: option.sort_order,
    })),
});

const toDepartmentOption = (row: DepartmentOptionRow): DepartmentOption => ({
  id: row.id,
  label: row.label,
  sortOrder: row.sort_order,
});

const parseWorkflowRoles = (value?: string): WorkflowRole[] =>
  WORKFLOW_ROLE_ORDER.filter((roleCode) => csvToArray(value).includes(roleCode));

const toUserSummary = (row: UserRow): UserSummary => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  role: row.role,
  workflowRoles: parseWorkflowRoles(row.workflow_roles),
  isActive: Boolean(row.is_active),
});

const toUserAccount = (row: UserRow): UserAccount => ({
  ...toUserSummary(row),
  createdAt: row.created_at ?? '',
  updatedAt: row.updated_at ?? '',
});

const toApprovalLog = (row: ApprovalLogRow): ApprovalLog => ({
  id: row.id,
  action: row.action,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  actorUserId: row.actor_user_id,
  actorUsername: row.actor_username,
  actorDisplayName: row.actor_display_name,
  targetUserId: row.target_user_id,
  targetDisplayName: row.target_display_name,
  comment: row.comment,
  createdAt: row.created_at,
});

const toAuditLog = (row: AuditLogRow): AuditLogEntry => ({
  id: row.id,
  category: row.category,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  actorUserId: row.actor_user_id,
  actorDisplayName: row.actor_display_name,
  targetUserId: row.target_user_id,
  targetDisplayName: row.target_display_name,
  summary: row.summary,
  detailText: row.detail_text,
  changes: JSON.parse(row.changes_json) as AuditLogChange[],
  ipAddress: row.ip_address,
  createdAt: row.created_at,
});

const todayString = () => new Date().toISOString().slice(0, 10);

const isAdmin = (user: AuthUser | null | undefined) => user?.role === 'admin';

const hasWorkflowRole = (user: AuthUser | null | undefined, role: WorkflowRole) =>
  Boolean(user && (user.role === 'admin' || user.workflowRoles.includes(role)));

const normalizeAuditValue = (value: string | null | undefined) => value?.trim() ?? '';

const compareAuditField = (
  changes: AuditLogChange[],
  field: string,
  before: string | null | undefined,
  after: string | null | undefined,
) => {
  const left = normalizeAuditValue(before);
  const right = normalizeAuditValue(after);

  if (left !== right) {
    changes.push({ field, before: left || '-', after: right || '-' });
  }
};

const summarizeOperations = (operations: CardOperation[]) =>
  operations
    .filter((operation) => operation.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((operation) => {
      const detailText = operation.details
        .map((detail) => {
          const params = Object.entries(detail.params)
            .filter(([, value]) => value.trim())
            .map(([key, value]) => `${key}:${value}`)
            .join(' / ');

          return [detail.detailType, params].filter(Boolean).join(' ');
        })
        .filter(Boolean)
        .join(' | ');

      return [
        operation.customName.trim() || operation.operationCode,
        operation.department,
        operation.specialCharacteristic,
        operation.deliveryTime,
        operation.otherRequirements,
        operation.selectedOptionCodes.join(','),
        detailText,
      ]
        .filter(Boolean)
        .join(' / ');
    })
    .join('; ');

function getAvailableActions(card: CardRow, viewer: AuthUser | null): ApprovalAction[] {
  if (!viewer || card.status === 'approved' || card.status === 'voided') {
    return [];
  }

  if (card.status === 'draft' || card.status === 'rejected_to_prepare') {
    if (
      isAdmin(viewer) ||
      (card.created_by_user_id === viewer.id && hasWorkflowRole(viewer, 'prepare'))
    ) {
      return ['submit_confirm'];
    }
    return [];
  }

  if (card.status === 'pending_confirm' || card.status === 'rejected_to_confirm') {
    if (
      isAdmin(viewer) ||
      (card.confirmed_user_id === viewer.id && hasWorkflowRole(viewer, 'confirm'))
    ) {
      return ['return_prepare', 'submit_review'];
    }
    return [];
  }

  if (card.status === 'pending_review' || card.status === 'rejected_to_review') {
    if (
      isAdmin(viewer) ||
      (card.reviewed_user_id === viewer.id && hasWorkflowRole(viewer, 'review'))
    ) {
      return ['reject_to_prepare', 'reject_to_confirm', 'submit_approve'];
    }
    return [];
  }

  if (card.status === 'pending_approve') {
    if (
      isAdmin(viewer) ||
      (card.approved_user_id === viewer.id && hasWorkflowRole(viewer, 'approve'))
    ) {
      return ['reject_to_review', 'approve'];
    }
    return [];
  }

  return [];
}

function getPermissions(card: CardRow, viewer: AuthUser | null): CardPermissions {
  if (!viewer || card.status === 'approved' || card.status === 'voided') {
    return {
      canEdit: false,
      canDelete: false,
      availableActions: getAvailableActions(card, viewer),
    };
  }

  const canEdit =
    isAdmin(viewer) ||
    ((card.status === 'draft' || card.status === 'rejected_to_prepare') &&
      card.created_by_user_id === viewer.id &&
      hasWorkflowRole(viewer, 'prepare')) ||
    ((card.status === 'pending_confirm' || card.status === 'rejected_to_confirm') &&
      card.confirmed_user_id === viewer.id &&
      hasWorkflowRole(viewer, 'confirm'));

  const canDelete =
    (card.status === 'draft' || card.status === 'rejected_to_prepare') &&
    (isAdmin(viewer) || card.created_by_user_id === viewer.id);

  return {
    canEdit,
    canDelete,
    availableActions: getAvailableActions(card, viewer),
  };
}

function getTargetUserIdForAction(card: CardRow, action: ApprovalAction) {
  switch (action) {
    case 'submit_confirm':
      return card.confirmed_user_id;
    case 'return_prepare':
    case 'reject_to_prepare':
      return card.created_by_user_id;
    case 'submit_review':
      return card.reviewed_user_id;
    case 'reject_to_confirm':
      return card.confirmed_user_id;
    case 'submit_approve':
      return card.approved_user_id;
    case 'reject_to_review':
      return card.reviewed_user_id;
    case 'approve':
      return card.approved_user_id;
  }
}

function getActionResult(card: CardRow, action: ApprovalAction, comment: string, actor: AuthUser) {
  const now = new Date().toISOString();
  const today = todayString();
  const base = {
    updated_at: now,
    last_return_comment: '',
    locked_at: card.locked_at,
    submitted_at: card.submitted_at,
    prepared_by: card.prepared_by,
    prepared_date: card.prepared_date,
    confirmed_by: card.confirmed_by,
    confirmed_date: card.confirmed_date,
    reviewed_by: card.reviewed_by,
    reviewed_date: card.reviewed_date,
    approved_by: card.approved_by,
    approved_date: card.approved_date,
  };

  switch (action) {
    case 'submit_confirm':
      return {
        ...base,
        status: 'pending_confirm' as const,
        current_step: 'confirm' as const,
        current_handler_user_id: card.confirmed_user_id,
        submitted_at: card.submitted_at || now,
        prepared_by: actor.displayName,
        prepared_date: today,
      };
    case 'return_prepare':
      return {
        ...base,
        status: 'rejected_to_prepare' as const,
        current_step: 'prepare' as const,
        current_handler_user_id: card.created_by_user_id,
        last_return_comment: comment,
      };
    case 'submit_review':
      return {
        ...base,
        status: 'pending_review' as const,
        current_step: 'review' as const,
        current_handler_user_id: card.reviewed_user_id,
        confirmed_by: actor.displayName,
        confirmed_date: today,
      };
    case 'reject_to_prepare':
      return {
        ...base,
        status: 'rejected_to_prepare' as const,
        current_step: 'prepare' as const,
        current_handler_user_id: card.created_by_user_id,
        last_return_comment: comment,
      };
    case 'reject_to_confirm':
      return {
        ...base,
        status: 'rejected_to_confirm' as const,
        current_step: 'confirm' as const,
        current_handler_user_id: card.confirmed_user_id,
        last_return_comment: comment,
      };
    case 'submit_approve':
      return {
        ...base,
        status: 'pending_approve' as const,
        current_step: 'approve' as const,
        current_handler_user_id: card.approved_user_id,
        reviewed_by: actor.displayName,
        reviewed_date: today,
      };
    case 'reject_to_review':
      return {
        ...base,
        status: 'rejected_to_review' as const,
        current_step: 'review' as const,
        current_handler_user_id: card.reviewed_user_id,
        last_return_comment: comment,
      };
    case 'approve':
      return {
        ...base,
        status: 'approved' as const,
        current_step: 'approve' as const,
        current_handler_user_id: '',
        approved_by: actor.displayName,
        approved_date: today,
        locked_at: now,
      };
  }
}

function requireCommentForAction(action: ApprovalAction, comment: string) {
  if (APPROVAL_ACTION_COMMENT_REQUIRED.includes(action) && !comment.trim()) {
    throw new Error('当前退回或驳回动作必须填写修改意见。');
  }
}

function buildProcessCardChanges(before: ProcessCardPayload | null, after: ProcessCardPayload): AuditLogChange[] {
  if (!before) {
    return [
      { field: '计划单号', before: '-', after: after.planNumber || '-' },
      { field: '产品名称', before: '-', after: after.productName || '-' },
      { field: '材质', before: '-', after: after.material || '-' },
      { field: '规格及公差（mm）', before: '-', after: after.specification || '-' },
      { field: '长度及公差（mm）', before: '-', after: after.lengthTolerance || '-' },
      { field: '启用工序', before: '-', after: summarizeOperations(after.operations) || '-' },
    ];
  }

  const changes: AuditLogChange[] = [];
  compareAuditField(changes, '计划单号', before.planNumber, after.planNumber);
  compareAuditField(changes, '客户代码', before.customerCode, after.customerCode);
  compareAuditField(changes, '接单日期', before.orderDate, after.orderDate);
  compareAuditField(changes, '产品名称', before.productName, after.productName);
  compareAuditField(changes, '材质', before.material, after.material);
  compareAuditField(changes, '规格及公差（mm）', before.specification, after.specification);
  compareAuditField(changes, '长度及公差（mm）', before.lengthTolerance, after.lengthTolerance);
  compareAuditField(changes, '数量（kg）', before.quantity, after.quantity);
  compareAuditField(changes, '交付日期', before.deliveryDate, after.deliveryDate);
  compareAuditField(changes, '交货状态', before.deliveryStatus, after.deliveryStatus);
  compareAuditField(changes, '执行标准', before.standard, after.standard);
  compareAuditField(changes, '技术要求', before.technicalRequirements, after.technicalRequirements);
  compareAuditField(changes, '确认人', before.confirmedUserId, after.confirmedUserId);
  compareAuditField(changes, '审核人', before.reviewedUserId, after.reviewedUserId);
  compareAuditField(changes, '批准人', before.approvedUserId, after.approvedUserId);
  compareAuditField(
    changes,
    '启用工序',
    summarizeOperations(before.operations),
    summarizeOperations(after.operations),
  );
  return changes;
}

export class ProcessCardRepository {
  private readonly sqlite = createDatabaseClient();

  async init() {
    await this.sqlite.init();
    const schemaFileName = appConfig.dbClient === 'postgres' ? 'schema.postgres.sql' : 'schema.sql';
    const schema = await readFile(path.join(projectRoot, 'server', 'db', schemaFileName), 'utf8');
    this.sqlite.exec(schema);
    this.ensureWorkflowSchema();
    this.ensureSystemSchema();
    this.seedDefinitions(false);
    this.migrateLegacyFormingOperations();
    this.migrateLegacyCustomOperations();
    this.seedDefinitions();
    this.seedDepartmentOptions();
    if (appConfig.seedDefaultUsers) {
      this.seedUsers();
      this.seedUserRoles();
    }
    this.backfillLegacyWorkflowFields();
    if (appConfig.seedDemoCard) {
      await this.seedDemoCard();
    }
    await this.sqlite.persist();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.sqlite.listColumns(table);
    if (!columns.includes(column)) {
      this.sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private ensureWorkflowSchema() {
    this.ensureColumn('process_cards', 'status', "TEXT NOT NULL DEFAULT 'draft'");
    this.ensureColumn('process_cards', 'length_tolerance', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('card_operations', 'custom_name', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'current_step', "TEXT NOT NULL DEFAULT 'prepare'");
    this.ensureColumn('process_cards', 'current_handler_user_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'created_by_user_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'confirmed_user_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'reviewed_user_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'approved_user_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'submitted_at', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'locked_at', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'version_no', 'INTEGER NOT NULL DEFAULT 1');
    this.ensureColumn('process_cards', 'source_card_id', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('process_cards', 'last_return_comment', "TEXT NOT NULL DEFAULT ''");
  }

  private ensureSystemSchema() {
    this.ensureColumn('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT '',
        entity_id TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL,
        actor_user_id TEXT NOT NULL DEFAULT '',
        actor_display_name TEXT NOT NULL DEFAULT '',
        target_user_id TEXT NOT NULL DEFAULT '',
        target_display_name TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        detail_text TEXT NOT NULL DEFAULT '',
        changes_json TEXT NOT NULL DEFAULT '[]',
        ip_address TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs (category);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

      CREATE TABLE IF NOT EXISTS notification_reads (
        user_id TEXT NOT NULL,
        notification_id TEXT NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (user_id, notification_id)
      );
      CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads (user_id);
    `);
  }

  private validateProcessCardRequiredFields(payload: {
    planNumber: string;
    productName: string;
    confirmedUserId: string;
    reviewedUserId: string;
    approvedUserId: string;
  }) {
    for (const fieldKey of REQUIRED_MAIN_INFO_KEYS) {
      const rawValue = payload[fieldKey];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!value) {
        throw new Error(`${mainInfoFieldLabels.get(fieldKey) ?? '主信息字段'}不能为空。`);
      }
    }

    if (!payload.confirmedUserId.trim()) {
      throw new Error('请选择确认人后再保存。');
    }

    if (!payload.reviewedUserId.trim()) {
      throw new Error('请选择审核人后再保存。');
    }

    if (!payload.approvedUserId.trim()) {
      throw new Error('请选择批准人后再保存。');
    }
  }

  private assertWorkflowAssigneeExists(userId: string, label: string) {
    const [user] = this.sqlite.query<{ id: string; is_active: number }>(
      'SELECT id, is_active FROM users WHERE id = ?',
      [userId],
    );

    if (!user) {
      throw new Error(`${label}不存在，请重新选择。`);
    }

    if (!user.is_active) {
      throw new Error(`${label}已停用，请重新选择。`);
    }
  }

  private seedDefinitions(pruneRemoved = true) {
    this.sqlite.transaction(() => {
      const activeCodes = PROCESS_CATALOG.map((definition) => definition.code);

      if (pruneRemoved) {
        this.sqlite.run(
          `DELETE FROM operation_option_definitions WHERE operation_code NOT IN (${activeCodes
            .map(() => '?')
            .join(', ')})`,
          activeCodes,
        );
        this.sqlite.run(
          `DELETE FROM operation_definitions WHERE code NOT IN (${activeCodes.map(() => '?').join(', ')})`,
          activeCodes,
        );
      }

      for (const definition of PROCESS_CATALOG) {
        this.sqlite.run(
          `
            INSERT INTO operation_definitions
            (code, name, default_order, detail_mode, allows_multiple_details, detail_label, field_config_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (code) DO UPDATE SET
              name = EXCLUDED.name,
              default_order = EXCLUDED.default_order,
              detail_mode = EXCLUDED.detail_mode,
              allows_multiple_details = EXCLUDED.allows_multiple_details,
              detail_label = EXCLUDED.detail_label,
              field_config_json = EXCLUDED.field_config_json
          `,
          [
            definition.code,
            definition.name,
            definition.defaultOrder,
            definition.detailMode,
            definition.allowsMultipleDetails ? 1 : 0,
            definition.detailLabel,
            JSON.stringify(definition.fieldConfig),
          ],
        );

        this.sqlite.run('DELETE FROM operation_option_definitions WHERE operation_code = ?', [
          definition.code,
        ]);

        for (const option of definition.optionCatalog) {
          this.sqlite.run(
            `
              INSERT INTO operation_option_definitions
              (operation_code, option_code, label, sort_order)
              VALUES (?, ?, ?, ?)
            `,
            [option.operationCode, option.optionCode, option.label, option.sortOrder],
          );
        }
      }
    });
  }

  private migrateLegacyFormingOperations() {
    const legacyOperations = this.sqlite.query<
      OperationRow & {
        card_id: string;
      }
    >(
      `
        SELECT
          id,
          card_id,
          operation_code,
          sort_order,
          enabled,
          custom_name,
          department,
          special_characteristic,
          delivery_time,
          other_requirements,
          remark
        FROM card_operations
        WHERE operation_code = 'forming'
      `,
    );

    if (legacyOperations.length === 0) {
      return;
    }

    this.sqlite.transaction(() => {
      for (const operation of legacyOperations) {
        const selectedOptions = this.sqlite.query<SelectedOptionRow>(
          'SELECT card_operation_id, option_code FROM card_operation_selected_options WHERE card_operation_id = ?',
          [operation.id],
        );
        const details = this.sqlite.query<DetailRow>(
          `
            SELECT id, card_operation_id, detail_seq, detail_type, display_text, params_json
            FROM operation_details
            WHERE card_operation_id = ?
            ORDER BY detail_seq ASC
          `,
          [operation.id],
        );

        const hasRolling = selectedOptions.some((option) => option.option_code === 'forming-1');
        const hasForging = selectedOptions.some((option) => option.option_code === 'forming-2');
        const targetCodes =
          hasRolling && hasForging ? ['rolling', 'forging'] : [hasForging ? 'forging' : 'rolling'];

        this.sqlite.run('DELETE FROM card_operation_selected_options WHERE card_operation_id = ?', [operation.id]);
        this.sqlite.run('UPDATE card_operations SET operation_code = ? WHERE id = ?', [
          targetCodes[0],
          operation.id,
        ]);

        if (targetCodes.length > 1) {
          const duplicatedOperationId = randomUUID();
          this.sqlite.run(
            `
              INSERT INTO card_operations
              (id, card_id, operation_code, sort_order, enabled, custom_name, department, special_characteristic, delivery_time, other_requirements, remark)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              duplicatedOperationId,
              operation.card_id,
              targetCodes[1],
              operation.sort_order + 5,
              operation.enabled,
              operation.custom_name,
              operation.department,
              operation.special_characteristic,
              operation.delivery_time,
              operation.other_requirements,
              operation.remark,
            ],
          );

          for (const detail of details) {
            this.sqlite.run(
              `
                INSERT INTO operation_details
                (id, card_operation_id, detail_seq, detail_type, display_text, params_json)
                VALUES (?, ?, ?, ?, ?, ?)
              `,
              [
                randomUUID(),
                duplicatedOperationId,
                detail.detail_seq,
                detail.detail_type,
                detail.display_text,
                detail.params_json,
              ],
            );
          }
        }
      }
    });
  }

  private migrateLegacyCustomOperations() {
    const legacyOperations = this.sqlite.query<
      OperationRow & {
        card_id: string;
      }
    >(
      `
        SELECT
          id,
          card_id,
          operation_code,
          sort_order,
          enabled,
          custom_name,
          department,
          special_characteristic,
          delivery_time,
          other_requirements,
          remark
        FROM card_operations
        WHERE operation_code = 'custom-operation'
      `,
    );

    if (legacyOperations.length === 0) {
      return;
    }

    this.sqlite.transaction(() => {
      for (const operation of legacyOperations) {
        this.sqlite.run(
          'UPDATE card_operations SET operation_code = ?, custom_name = ? WHERE id = ?',
          ['custom-operation-1', operation.custom_name || '自定义工序', operation.id],
        );
      }
    });
  }

  private seedDepartmentOptions() {
    const [{ count }] = this.sqlite.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM department_options',
    );

    if (count > 0) {
      return;
    }

    const now = new Date().toISOString();
    this.sqlite.transaction(() => {
      DEFAULT_DEPARTMENT_OPTIONS.forEach((label, index) => {
        this.sqlite.run(
          `
            INSERT INTO department_options (id, label, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `,
          [randomUUID(), label, index + 1, now, now],
        );
      });
    });
  }

  private hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const computedHash = scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return storedBuffer.length === computedHash.length && timingSafeEqual(storedBuffer, computedHash);
  }

  private upsertSeedUser(input: {
    username: string;
    displayName: string;
    password: string;
    role: UserRole;
  }) {
    const [existing] = this.sqlite.query<{ id: string }>('SELECT id FROM users WHERE username = ?', [
      input.username,
    ]);

    if (existing) {
      return existing.id;
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    this.sqlite.run(
      `
        INSERT INTO users (id, username, display_name, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.username,
        input.displayName,
        this.hashPassword(input.password),
        input.role,
        1,
        now,
        now,
      ],
    );
    return id;
  }

  private seedUsers() {
    this.sqlite.transaction(() => {
      this.upsertSeedUser({
        username: 'admin',
        displayName: '系统管理员',
        password: 'admin123',
        role: 'admin',
      });
      this.upsertSeedUser({
        username: 'operator',
        displayName: '工艺编制员',
        password: 'operator123',
        role: 'user',
      });
      this.upsertSeedUser({
        username: 'confirmer',
        displayName: '工艺确认员',
        password: 'confirm123',
        role: 'user',
      });
      this.upsertSeedUser({
        username: 'reviewer',
        displayName: '工艺审核员',
        password: 'review123',
        role: 'user',
      });
      this.upsertSeedUser({
        username: 'approver',
        displayName: '工艺批准员',
        password: 'approve123',
        role: 'user',
      });
    });
  }

  private getUserIdByUsername(username: string) {
    const [row] = this.sqlite.query<{ id: string }>('SELECT id FROM users WHERE username = ?', [username]);
    return row?.id ?? '';
  }

  private ensureUserRole(userId: string, roleCode: WorkflowRole) {
    if (!userId) {
      return;
    }

    const [existing] = this.sqlite.query<{ id: string }>(
      'SELECT id FROM user_roles WHERE user_id = ? AND role_code = ?',
      [userId, roleCode],
    );
    if (existing) {
      return;
    }

    this.sqlite.run(
      `
        INSERT INTO user_roles (id, user_id, role_code, created_at)
        VALUES (?, ?, ?, ?)
      `,
      [randomUUID(), userId, roleCode, new Date().toISOString()],
    );
  }

  private seedUserRoles() {
    this.sqlite.transaction(() => {
      const adminId = this.getUserIdByUsername('admin');
      const operatorId = this.getUserIdByUsername('operator');
      const confirmerId = this.getUserIdByUsername('confirmer');
      const reviewerId = this.getUserIdByUsername('reviewer');
      const approverId = this.getUserIdByUsername('approver');

      WORKFLOW_ROLE_ORDER.forEach((roleCode) => this.ensureUserRole(adminId, roleCode));
      this.ensureUserRole(operatorId, 'prepare');
      this.ensureUserRole(confirmerId, 'confirm');
      this.ensureUserRole(reviewerId, 'review');
      this.ensureUserRole(approverId, 'approve');
    });
  }

  private backfillLegacyWorkflowFields() {
    const fallbackCreatorId = this.getUserIdByUsername('operator') || this.getUserIdByUsername('admin');

    this.sqlite.transaction(() => {
      this.sqlite.run(
        `
          UPDATE process_cards
          SET created_by_user_id = CASE
            WHEN TRIM(created_by_user_id) = '' THEN ?
            ELSE created_by_user_id
          END
        `,
        [fallbackCreatorId],
      );

      this.sqlite.run(
        `
          UPDATE process_cards
          SET status = CASE WHEN TRIM(status) = '' THEN 'draft' ELSE status END,
              current_step = CASE WHEN TRIM(current_step) = '' THEN 'prepare' ELSE current_step END,
              current_handler_user_id = CASE
                WHEN TRIM(current_handler_user_id) = '' THEN created_by_user_id
                ELSE current_handler_user_id
              END,
              version_no = CASE WHEN version_no IS NULL OR version_no <= 0 THEN 1 ELSE version_no END
        `,
      );
    });
  }

  private async seedDemoCard() {
    const [{ count }] = this.sqlite.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM process_cards',
    );

    if (count > 0) {
      return;
    }

    const users = await this.getUsers();
    const creator = users.find((user) => hasWorkflowRole(user, 'prepare')) ?? users[0];
    if (!creator) {
      return;
    }

    const demo = createDemoProcessCard(await this.getOperationDefinitions());
    demo.confirmedUserId = this.getUserIdByUsername('confirmer');
    demo.reviewedUserId = this.getUserIdByUsername('reviewer');
    demo.approvedUserId = this.getUserIdByUsername('approver');
    await this.saveProcessCard(demo, creator);
  }

  private writeAuditLog(input: {
    category: AuditLogCategory;
    entityType: string;
    entityId?: string;
    action: string;
    actor?: AuthUser | null;
    actorDisplayName?: string;
    targetUserId?: string;
    targetDisplayName?: string;
    summary: string;
    detailText?: string;
    changes?: AuditLogChange[];
    ipAddress?: string;
  }) {
    this.sqlite.run(
      `
        INSERT INTO audit_logs
        (id, category, entity_type, entity_id, action, actor_user_id, actor_display_name, target_user_id, target_display_name, summary, detail_text, changes_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        input.category,
        input.entityType,
        input.entityId ?? '',
        input.action,
        input.actor?.id ?? '',
        input.actor?.displayName ?? input.actorDisplayName ?? '',
        input.targetUserId ?? '',
        input.targetDisplayName ?? '',
        input.summary,
        input.detailText ?? '',
        JSON.stringify(input.changes ?? []),
        input.ipAddress ?? '',
        new Date().toISOString(),
      ],
    );
  }

  private getCardDisplayTitle(card: CardRow) {
    return card.plan_number || card.product_name || card.id;
  }

  private getCardTargetPath(card: CardRow, viewer: AuthUser) {
    return getPermissions(card, viewer).canEdit ? `/cards/${card.id}/edit` : `/cards/${card.id}/print`;
  }

  private getNotificationReadMap(userId: string) {
    const rows = this.sqlite.query<NotificationReadRow>(
      `
        SELECT notification_id
        FROM notification_reads
        WHERE user_id = ?
      `,
      [userId],
    );

    return new Set(rows.map((row) => row.notification_id));
  }

  private collectRelatedCardIds(cardRows: CardRow[], viewer: AuthUser) {
    const relatedCardIds = new Set<string>();

    if (isAdmin(viewer)) {
      cardRows.forEach((row) => relatedCardIds.add(row.id));
      return relatedCardIds;
    }

    cardRows.forEach((row) => {
      if (row.created_by_user_id === viewer.id) {
        relatedCardIds.add(row.id);
      }
      if (hasWorkflowRole(viewer, 'confirm') && row.confirmed_user_id === viewer.id) {
        relatedCardIds.add(row.id);
      }
      if (hasWorkflowRole(viewer, 'review') && row.reviewed_user_id === viewer.id) {
        relatedCardIds.add(row.id);
      }
      if (hasWorkflowRole(viewer, 'approve') && row.approved_user_id === viewer.id) {
        relatedCardIds.add(row.id);
      }
    });

    return relatedCardIds;
  }

  private buildNotificationItems(
    cardRows: CardRow[],
    viewer: AuthUser,
    readMap: Set<string> = new Set(),
  ): NotificationItem[] {
    const items: NotificationItem[] = [];
    const pushCardNotice = (
      card: CardRow,
      level: NotificationItem['level'],
      type: NotificationItem['type'],
      suffix: string,
      title: string,
      description: string,
      actionLabel: string,
      to?: string,
    ) => {
      const id = `card-${card.id}-${suffix}-${card.updated_at}`;
      items.push({
        id,
        type,
        title,
        description,
        createdAt: card.updated_at,
        level,
        isRead: readMap.has(id),
        actionLabel,
        to: to ?? this.getCardTargetPath(card, viewer),
      });
    };

    if (isAdmin(viewer)) {
      const pendingTotal = cardRows.filter(
        (card) =>
          card.status !== 'approved' &&
          card.status !== 'voided',
      ).length;

      if (pendingTotal > 0) {
        const id = `admin-global-pending-${pendingTotal}`;
        items.push({
          id,
          type: 'todo',
          title: `当前共有 ${pendingTotal} 张流程中工艺卡`,
          description: '可进入工作台或工艺卡列表统筹查看待确认、待审核和待批准单据。',
          createdAt: new Date().toISOString(),
          level: 'todo',
          isRead: readMap.has(id),
          actionLabel: '查看列表',
          to: '/cards',
        });
      }
    }

    for (const card of cardRows) {
      const cardTitle = this.getCardDisplayTitle(card);

      if (
        hasWorkflowRole(viewer, 'prepare') &&
        card.created_by_user_id === viewer.id &&
        card.status === 'draft'
      ) {
        pushCardNotice(card, 'todo', 'todo', 'draft', `${cardTitle} 仍是草稿`, '请尽快补全信息并提交确认。', '继续编制');
      }

      if (
        hasWorkflowRole(viewer, 'prepare') &&
        card.created_by_user_id === viewer.id &&
        card.status === 'rejected_to_prepare'
      ) {
        pushCardNotice(
          card,
          'warning',
          'todo',
          'rejected-to-prepare',
          `${cardTitle} 已退回编制`,
          card.last_return_comment.trim() || '请根据退回意见修改后重新提交。',
          '立即修改',
        );
      }

      if (
        hasWorkflowRole(viewer, 'confirm') &&
        card.current_handler_user_id === viewer.id &&
        (card.status === 'pending_confirm' || card.status === 'rejected_to_confirm')
      ) {
        pushCardNotice(
          card,
          card.status === 'rejected_to_confirm' ? 'warning' : 'todo',
          'todo',
          card.status === 'rejected_to_confirm' ? 'rejected-to-confirm' : 'pending-confirm',
          `${cardTitle} 待你确认`,
          card.status === 'rejected_to_confirm'
            ? card.last_return_comment.trim() || '该工艺卡已回到确认环节，请重新处理。'
            : '请核对内容后提交审核或退回编制。',
          '进入确认',
        );
      }

      if (
        hasWorkflowRole(viewer, 'review') &&
        card.current_handler_user_id === viewer.id &&
        (card.status === 'pending_review' || card.status === 'rejected_to_review')
      ) {
        pushCardNotice(
          card,
          card.status === 'rejected_to_review' ? 'warning' : 'todo',
          'todo',
          card.status === 'rejected_to_review' ? 'rejected-to-review' : 'pending-review',
          `${cardTitle} 待你审核`,
          card.status === 'rejected_to_review'
            ? card.last_return_comment.trim() || '该工艺卡已退回审核环节，请重新审阅。'
            : '建议先查看打印版式，再决定通过或驳回。',
          '进入审阅',
          `/cards/${card.id}/print`,
        );
      }

      if (
        hasWorkflowRole(viewer, 'approve') &&
        card.current_handler_user_id === viewer.id &&
        card.status === 'pending_approve'
      ) {
        pushCardNotice(
          card,
          'todo',
          'todo',
          'pending-approve',
          `${cardTitle} 待你批准`,
          '批准通过后工艺卡将锁定，请确认无误后再提交。',
          '进入批准',
          `/cards/${card.id}/print`,
        );
      }
    }

    const relatedCardIds = this.collectRelatedCardIds(cardRows, viewer);
    if (relatedCardIds.size > 0) {
      const placeholders = Array.from({ length: relatedCardIds.size }, () => '?').join(', ');
      const recentLogs = isAdmin(viewer)
        ? this.sqlite.query<AuditLogRow>(
            `
              SELECT *
              FROM audit_logs
              WHERE category IN ('process_card', 'approval')
                AND entity_type = 'process_card'
                AND entity_id IN (${placeholders})
              ORDER BY created_at DESC
              LIMIT 10
            `,
            [...relatedCardIds],
          )
        : this.sqlite.query<AuditLogRow>(
            `
              SELECT *
              FROM audit_logs
              WHERE category IN ('process_card', 'approval')
                AND entity_type = 'process_card'
                AND entity_id IN (${placeholders})
                AND (target_user_id = ? OR actor_user_id = ?)
              ORDER BY created_at DESC
              LIMIT 10
            `,
            [...relatedCardIds, viewer.id, viewer.id],
          );

      for (const row of recentLogs) {
        const id = `log-${row.id}`;
        items.push({
          id,
          type: 'notice',
          title: row.summary,
          description: row.detail_text || `${row.actor_display_name || '系统'} 发起了流程变更。`,
          createdAt: row.created_at,
          level: row.category === 'approval' ? 'info' : 'success',
          isRead: readMap.has(id),
          actionLabel: '查看单据',
          to: row.entity_id ? `/cards/${row.entity_id}/print` : '/cards',
        });
      }
    }

    return items
      .sort((left, right) => {
        if (left.isRead !== right.isRead) {
          return Number(left.isRead) - Number(right.isRead);
        }

        return right.createdAt.localeCompare(left.createdAt);
      })
      .slice(0, 12);
  }

  async getNotificationOverview(viewer: AuthUser): Promise<NotificationOverview> {
    const cardRows = this.sqlite.query<CardRow>(
      `
        SELECT *
        FROM process_cards
        ORDER BY updated_at DESC
      `,
    );

    const readMap = this.getNotificationReadMap(viewer.id);
    const items = this.buildNotificationItems(cardRows, viewer, readMap);

    return {
      totalCount: items.length,
      todoCount: items.filter((item) => item.type === 'todo').length,
      unreadCount: items.filter((item) => !item.isRead).length,
      items,
    };
  }

  async markNotificationRead(viewer: AuthUser, notificationId: string) {
    const nowIso = new Date().toISOString();

    this.sqlite.run(
      `
        INSERT INTO notification_reads (user_id, notification_id, read_at)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id, notification_id) DO UPDATE SET
          read_at = excluded.read_at
      `,
      [viewer.id, notificationId, nowIso],
    );

    return this.getNotificationOverview(viewer);
  }

  async markAllNotificationsRead(viewer: AuthUser) {
    const overview = await this.getNotificationOverview(viewer);
    const nowIso = new Date().toISOString();

    for (const item of overview.items.filter((entry) => !entry.isRead)) {
      this.sqlite.run(
        `
          INSERT INTO notification_reads (user_id, notification_id, read_at)
          VALUES (?, ?, ?)
          ON CONFLICT (user_id, notification_id) DO UPDATE SET
            read_at = excluded.read_at
        `,
        [viewer.id, item.id, nowIso],
      );
    }

    return this.getNotificationOverview(viewer);
  }

  async listAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    const parsed = auditLogFiltersSchema.parse(filters);
    const whereClauses = ['1 = 1'];
    const params: string[] = [];

    if (parsed.category?.trim()) {
      whereClauses.push('category = ?');
      params.push(parsed.category.trim());
    }

    if (parsed.actorUserId?.trim()) {
      whereClauses.push('actor_user_id = ?');
      params.push(parsed.actorUserId.trim());
    }

    if (parsed.keyword?.trim()) {
      whereClauses.push('(summary LIKE ? OR detail_text LIKE ? OR target_display_name LIKE ? OR actor_display_name LIKE ?)');
      params.push(
        `%${parsed.keyword.trim()}%`,
        `%${parsed.keyword.trim()}%`,
        `%${parsed.keyword.trim()}%`,
        `%${parsed.keyword.trim()}%`,
      );
    }

    const rows = this.sqlite.query<AuditLogRow>(
      `
        SELECT *
        FROM audit_logs
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT 300
      `,
      params,
    );

    return rows.map(toAuditLog);
  }

  async getDashboardOverview(viewer: AuthUser): Promise<DashboardOverview> {
    const cardRows = this.sqlite.query<CardRow>(
      `
        SELECT *
        FROM process_cards
        ORDER BY created_at DESC
      `,
    );

    const now = dayjs();
    const todayStart = now.startOf('day');
    const weekStart = now.startOf('isoWeek');
    const monthStart = now.startOf('month');
    const yearStart = now.startOf('year');

    const countCreatedSince = (start: dayjs.Dayjs) =>
      cardRows.filter((row) => dayjs(row.created_at).isAfter(start) || dayjs(row.created_at).isSame(start)).length;

    const tasks: DashboardTaskSummary = {
      draftCount: hasWorkflowRole(viewer, 'prepare') || isAdmin(viewer)
        ? cardRows.filter(
            (row) =>
              row.created_by_user_id === viewer.id &&
              (row.status === 'draft' || row.status === 'rejected_to_prepare'),
          ).length
        : 0,
      pendingConfirmCount: hasWorkflowRole(viewer, 'confirm') || isAdmin(viewer)
        ? cardRows.filter(
            (row) =>
              row.current_handler_user_id === viewer.id &&
              (row.status === 'pending_confirm' || row.status === 'rejected_to_confirm'),
          ).length
        : 0,
      pendingReviewCount: hasWorkflowRole(viewer, 'review') || isAdmin(viewer)
        ? cardRows.filter(
            (row) =>
              row.current_handler_user_id === viewer.id &&
              (row.status === 'pending_review' || row.status === 'rejected_to_review'),
          ).length
        : 0,
      pendingApproveCount: hasWorkflowRole(viewer, 'approve') || isAdmin(viewer)
        ? cardRows.filter(
            (row) => row.current_handler_user_id === viewer.id && row.status === 'pending_approve',
          ).length
        : 0,
      returnedCount: cardRows.filter(
        (row) =>
          row.last_return_comment.trim() &&
          ((row.status === 'rejected_to_prepare' && row.created_by_user_id === viewer.id) ||
            (row.status === 'rejected_to_confirm' && row.confirmed_user_id === viewer.id) ||
            (row.status === 'rejected_to_review' && row.reviewed_user_id === viewer.id)),
      ).length,
      totalPendingCount: 0,
    };
    tasks.totalPendingCount =
      tasks.draftCount +
      tasks.pendingConfirmCount +
      tasks.pendingReviewCount +
      tasks.pendingApproveCount +
      tasks.returnedCount;

    const stats: DashboardStatSummary = {
      todayCreated: countCreatedSince(todayStart),
      weekCreated: countCreatedSince(weekStart),
      monthCreated: countCreatedSince(monthStart),
      yearCreated: countCreatedSince(yearStart),
      approvedCount: cardRows.filter((row) => row.status === 'approved').length,
      voidedCount: cardRows.filter((row) => row.status === 'voided').length,
    };

    const trend: DashboardTrendPoint[] = Array.from({ length: 7 }, (_, index) => {
      const current = now.startOf('day').subtract(6 - index, 'day');
      const next = current.add(1, 'day');
      return {
        label: current.format('MM-DD'),
        value: cardRows.filter((row) => {
          const createdAt = dayjs(row.created_at);
          return (createdAt.isAfter(current) || createdAt.isSame(current)) && createdAt.isBefore(next);
        }).length,
      };
    });

    const statusDistribution: DashboardDistributionItem[] = [
      { label: '草稿', value: cardRows.filter((row) => row.status === 'draft').length },
      {
        label: '待确认',
        value: cardRows.filter((row) => row.status === 'pending_confirm' || row.status === 'rejected_to_confirm').length,
      },
      {
        label: '待审核',
        value: cardRows.filter((row) => row.status === 'pending_review' || row.status === 'rejected_to_review').length,
      },
      { label: '待批准', value: cardRows.filter((row) => row.status === 'pending_approve').length },
      { label: '已批准', value: cardRows.filter((row) => row.status === 'approved').length },
      { label: '已作废', value: cardRows.filter((row) => row.status === 'voided').length },
    ];

    const relatedCardIds = this.collectRelatedCardIds(cardRows, viewer);
    const notificationReadMap = this.getNotificationReadMap(viewer.id);
    const notifications = this.buildNotificationItems(cardRows, viewer, notificationReadMap);

    const recentActivities: DashboardActivityItem[] =
      relatedCardIds.size === 0
        ? []
        : this.sqlite
            .query<AuditLogRow>(
        `
          SELECT *
          FROM audit_logs
          WHERE category IN ('process_card', 'approval')
            AND entity_type = 'process_card'
            AND entity_id IN (${Array.from({ length: relatedCardIds.size }, () => '?').join(', ')})
          ORDER BY created_at DESC
          LIMIT 8
        `,
        [...relatedCardIds],
      )
      .map((row) => ({
        id: row.id,
        category: row.category,
        entityId: row.entity_id,
        title: row.summary,
        actorDisplayName: row.actor_display_name || '系统',
        createdAt: row.created_at,
        statusLabel:
          row.category === 'approval'
            ? '审批流转'
            : row.action === 'create'
              ? '新建'
              : row.action === 'update'
                ? '编辑'
                : row.action === 'delete'
                  ? '删除'
                  : row.action === 'void'
                    ? '作废'
                    : row.action === 'force_delete'
                      ? '强制删除'
                      : '动态',
      }));

    return {
      tasks,
      stats,
      trend,
      statusDistribution: statusDistribution.filter((item) => item.value > 0),
      recentActivities,
      notifications,
      notificationCount: notifications.filter((item) => item.type === 'todo' && !item.isRead).length,
    };
  }

  async getOperationDefinitions(): Promise<OperationDefinition[]> {
    const definitionRows = this.sqlite.query<DefinitionRow>(
      `
        SELECT code, name, default_order, detail_mode, allows_multiple_details, detail_label, field_config_json
        FROM operation_definitions
        ORDER BY default_order ASC
      `,
    );

    const optionRows = this.sqlite.query<OptionRow>(
      `
        SELECT operation_code, option_code, label, sort_order
        FROM operation_option_definitions
        ORDER BY operation_code ASC, sort_order ASC
      `,
    );

    return definitionRows.map((row) => toDefinition(row, optionRows));
  }

  async getDepartmentOptions(): Promise<DepartmentOption[]> {
    const rows = this.sqlite.query<DepartmentOptionRow>(
      `
        SELECT id, label, sort_order
        FROM department_options
        ORDER BY sort_order ASC, created_at ASC
      `,
    );
    return rows.map(toDepartmentOption);
  }

  async saveDepartmentOptions(input: DepartmentOption[], actor?: AuthUser, ipAddress = '') {
    const items = departmentOptionListSchema.parse(input);
    const now = new Date().toISOString();
    const before = await this.getDepartmentOptions();

    this.sqlite.transaction(() => {
      this.sqlite.run('DELETE FROM department_options');

      items
        .map((item, index) => ({
          id: item.id || randomUUID(),
          label: item.label.trim(),
          sortOrder: index + 1,
        }))
        .forEach((item) => {
          this.sqlite.run(
            `
              INSERT INTO department_options (id, label, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `,
            [item.id, item.label, item.sortOrder, now, now],
          );
        });

      if (actor) {
        const changes: AuditLogChange[] = [];
        compareAuditField(
          changes,
          '生产部门字典',
          before.map((item) => item.label).join(' / '),
          items.map((item) => item.label.trim()).filter(Boolean).join(' / '),
        );
        this.writeAuditLog({
          category: 'dictionary',
          entityType: 'department_options',
          action: 'update',
          actor,
          summary: '更新生产部门字典',
          detailText: '保存了生产部门下拉配置。',
          changes,
          ipAddress,
        });
      }
    });

    await this.sqlite.persist();
    return this.getDepartmentOptions();
  }

  async getUsers(): Promise<UserSummary[]> {
    const rows = this.sqlite.query<UserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.role,
          u.is_active,
          GROUP_CONCAT(ur.role_code) AS workflow_roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.is_active = 1
        GROUP BY u.id
        ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.username ASC
      `,
    );

    return rows.map(toUserSummary);
  }

  async getUserAccounts(): Promise<UserAccount[]> {
    const rows = this.sqlite.query<UserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          GROUP_CONCAT(ur.role_code) AS workflow_roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        GROUP BY u.id
        ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.username ASC
      `,
    );

    return rows.map(toUserAccount);
  }

  private replaceUserWorkflowRoles(userId: string, workflowRoles: WorkflowRole[]) {
    this.sqlite.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    workflowRoles.forEach((roleCode) => {
      this.sqlite.run(
        'INSERT INTO user_roles (id, user_id, role_code, created_at) VALUES (?, ?, ?, ?)',
        [randomUUID(), userId, roleCode, new Date().toISOString()],
      );
    });
  }

  async createUserAccount(input: UserAccountCreateRequest, actor: AuthUser, ipAddress = '') {
    const payload = userAccountCreateSchema.parse(input);
    const now = new Date().toISOString();
    const userId = randomUUID();
    const username = payload.username.trim().toLowerCase();

    const [existing] = this.sqlite.query<{ id: string }>('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      throw new Error('登录账号已存在，请更换用户名。');
    }

    this.sqlite.transaction(() => {
      this.sqlite.run(
        `
          INSERT INTO users (id, username, display_name, password_hash, role, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          username,
          payload.displayName.trim(),
          this.hashPassword(payload.password),
          payload.role,
          payload.isActive ? 1 : 0,
          now,
          now,
        ],
      );
      this.replaceUserWorkflowRoles(userId, payload.workflowRoles);
      this.writeAuditLog({
        category: 'user',
        entityType: 'user',
        entityId: userId,
        action: 'create',
        actor,
        targetUserId: userId,
        targetDisplayName: payload.displayName.trim(),
        summary: `新增账号：${payload.displayName.trim()}（${username}）`,
        detailText: `角色：${payload.role}；流程角色：${payload.workflowRoles.join(' / ') || '无'}；状态：${payload.isActive ? '启用' : '停用'}`,
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getUserAccounts();
  }

  async updateUserAccount(id: string, input: UserAccountUpdateRequest, actor: AuthUser, ipAddress = '') {
    const payload = userAccountUpdateSchema.parse(input);
    const [existing] = this.sqlite.query<UserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          GROUP_CONCAT(ur.role_code) AS workflow_roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.id = ?
        GROUP BY u.id
      `,
      [id],
    );

    if (!existing) {
      throw new Error('账号不存在。');
    }

    const changes: AuditLogChange[] = [];
    compareAuditField(changes, '显示名称', existing.display_name, payload.displayName);
    compareAuditField(changes, '系统角色', existing.role, payload.role);
    compareAuditField(
      changes,
      '流程角色',
      parseWorkflowRoles(existing.workflow_roles).join(' / '),
      payload.workflowRoles.join(' / '),
    );

    this.sqlite.transaction(() => {
      this.sqlite.run(
        'UPDATE users SET display_name = ?, role = ?, updated_at = ? WHERE id = ?',
        [payload.displayName.trim(), payload.role, new Date().toISOString(), id],
      );
      this.replaceUserWorkflowRoles(id, payload.workflowRoles);
      this.writeAuditLog({
        category: 'user',
        entityType: 'user',
        entityId: id,
        action: 'update',
        actor,
        targetUserId: id,
        targetDisplayName: payload.displayName.trim(),
        summary: `更新账号：${payload.displayName.trim()}（${existing.username}）`,
        detailText: changes.length > 0 ? '更新了账号信息与角色分配。' : '保存账号信息，无字段变化。',
        changes,
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getUserAccounts();
  }

  async resetUserPassword(id: string, input: UserPasswordResetRequest, actor: AuthUser, ipAddress = '') {
    const payload = userPasswordResetSchema.parse(input);
    const [existing] = this.sqlite.query<UserRow>('SELECT id, username, display_name, role, is_active FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('账号不存在。');
    }

    this.sqlite.transaction(() => {
      this.sqlite.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
        this.hashPassword(payload.password),
        new Date().toISOString(),
        id,
      ]);
      this.writeAuditLog({
        category: 'user',
        entityType: 'user',
        entityId: id,
        action: 'reset_password',
        actor,
        targetUserId: id,
        targetDisplayName: existing.display_name,
        summary: `重置密码：${existing.display_name}（${existing.username}）`,
        detailText: '管理员重置了登录密码。',
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return { success: true };
  }

  async setUserActive(id: string, isActive: boolean, actor: AuthUser, ipAddress = '') {
    const payload = userActiveToggleSchema.parse({ isActive });
    const [existing] = this.sqlite.query<UserRow>('SELECT id, username, display_name, role, is_active FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('账号不存在。');
    }

    if (existing.username === 'admin' && !payload.isActive) {
      throw new Error('默认管理员账号不能被停用。');
    }

    this.sqlite.transaction(() => {
      this.sqlite.run('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [
        payload.isActive ? 1 : 0,
        new Date().toISOString(),
        id,
      ]);

      if (!payload.isActive) {
        this.sqlite.run('DELETE FROM sessions WHERE user_id = ?', [id]);
      }

      this.writeAuditLog({
        category: 'user',
        entityType: 'user',
        entityId: id,
        action: payload.isActive ? 'enable' : 'disable',
        actor,
        targetUserId: id,
        targetDisplayName: existing.display_name,
        summary: `${payload.isActive ? '启用' : '停用'}账号：${existing.display_name}（${existing.username}）`,
        detailText: '',
        changes: [
          {
            field: '账号状态',
            before: existing.is_active ? '启用' : '停用',
            after: payload.isActive ? '启用' : '停用',
          },
        ],
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getUserAccounts();
  }

  async deleteUserAccount(id: string, actor: AuthUser, ipAddress = '') {
    const [existing] = this.sqlite.query<UserRow>(
      'SELECT id, username, display_name, role, is_active FROM users WHERE id = ?',
      [id],
    );

    if (!existing) {
      throw new Error('账号不存在。');
    }

    if (existing.id === actor.id) {
      throw new Error('不能删除当前登录账号。');
    }

    if (existing.username === 'admin') {
      throw new Error('默认管理员账号不能删除。');
    }

    const [{ count: processCardCount }] = this.sqlite.query<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM process_cards
        WHERE created_by_user_id = ?
           OR confirmed_user_id = ?
           OR reviewed_user_id = ?
           OR approved_user_id = ?
           OR current_handler_user_id = ?
      `,
      [id, id, id, id, id],
    );

    if (processCardCount > 0) {
      throw new Error('该账号已参与工艺卡流程，不能删除，请改为停用。');
    }

    this.sqlite.transaction(() => {
      this.sqlite.run('DELETE FROM sessions WHERE user_id = ?', [id]);
      this.sqlite.run('DELETE FROM user_roles WHERE user_id = ?', [id]);
      this.sqlite.run('DELETE FROM users WHERE id = ?', [id]);
      this.writeAuditLog({
        category: 'user',
        entityType: 'user',
        entityId: id,
        action: 'delete',
        actor,
        targetUserId: id,
        targetDisplayName: existing.display_name,
        summary: `删除账号：${existing.display_name}（${existing.username}）`,
        detailText: '管理员删除了未参与工艺卡流程的账号，历史日志保留。',
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getUserAccounts();
  }

  async login(username: string, password: string, ipAddress = ''): Promise<LoginResponse | null> {
    const normalizedUsername = username.trim().toLowerCase();
    const [user] = this.sqlite.query<UserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.password_hash,
          u.role,
          u.is_active,
          GROUP_CONCAT(ur.role_code) AS workflow_roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.username = ?
        GROUP BY u.id
      `,
      [normalizedUsername],
    );

    if (!user?.password_hash || !this.verifyPassword(password, user.password_hash)) {
      this.sqlite.run(
        `
          INSERT INTO audit_logs
          (id, category, entity_type, entity_id, action, actor_user_id, actor_display_name, target_user_id, target_display_name, summary, detail_text, changes_json, ip_address, created_at)
          VALUES (?, 'auth', 'session', '', 'login_failed', '', ?, '', '', ?, ?, '[]', ?, ?)
        `,
        [
          randomUUID(),
          normalizedUsername,
          `登录失败：${normalizedUsername}`,
          '用户名或密码错误。',
          ipAddress,
          new Date().toISOString(),
        ],
      );
      await this.sqlite.persist();
      return null;
    }

    if (!user.is_active) {
      this.writeAuditLog({
        category: 'auth',
        entityType: 'session',
        action: 'login_blocked',
        actorDisplayName: user.display_name,
        summary: `登录被拒绝：${user.display_name}`,
        detailText: '账号已停用。',
        ipAddress,
      });
      await this.sqlite.persist();
      throw new Error('账号已停用，请联系管理员。');
    }

    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    this.sqlite.run('DELETE FROM sessions WHERE expires_at <= ?', [nowIso]);
    this.sqlite.run(
      `
        INSERT INTO sessions (token, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `,
      [token, user.id, expiresAt, nowIso],
    );

    this.writeAuditLog({
      category: 'auth',
      entityType: 'session',
      entityId: token,
      action: 'login',
      actor: toUserSummary(user),
      summary: `登录成功：${user.display_name}`,
      detailText: `账号：${user.username}`,
      ipAddress,
    });

    await this.sqlite.persist();

    return {
      token,
      user: toUserSummary(user),
    };
  }

  async getAuthUserByToken(token: string): Promise<AuthUser | null> {
    const now = new Date().toISOString();
    const [row] = this.sqlite.query<UserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.role,
          u.is_active,
          GROUP_CONCAT(ur.role_code) AS workflow_roles
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE s.token = ?
          AND s.expires_at > ?
          AND u.is_active = 1
        GROUP BY u.id
      `,
      [token, now],
    );

    return row ? toUserSummary(row) : null;
  }

  async logout(token: string, actor?: AuthUser | null, ipAddress = '') {
    this.sqlite.run('DELETE FROM sessions WHERE token = ?', [token]);
    if (actor) {
      this.writeAuditLog({
        category: 'auth',
        entityType: 'session',
        entityId: token,
        action: 'logout',
        actor,
        summary: `退出登录：${actor.displayName}`,
        ipAddress,
      });
    }
    await this.sqlite.persist();
  }

  private async getOperationRecords(cardId: string) {
    const operationRows = this.sqlite.query<OperationRow>(
      'SELECT * FROM card_operations WHERE card_id = ? ORDER BY sort_order ASC',
      [cardId],
    );
    const selectedOptionRows = this.sqlite.query<SelectedOptionRow>(
      `
        SELECT card_operation_id, option_code
        FROM card_operation_selected_options
        WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
      `,
      [cardId],
    );
    const detailRows = this.sqlite.query<DetailRow>(
      `
        SELECT *
        FROM operation_details
        WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
        ORDER BY detail_seq ASC
      `,
      [cardId],
    );

    return { operationRows, selectedOptionRows, detailRows };
  }

  private getApprovalLogs(cardId: string): ApprovalLog[] {
    const rows = this.sqlite.query<ApprovalLogRow>(
      `
        SELECT
          l.id,
          l.action,
          l.from_status,
          l.to_status,
          l.actor_user_id,
          COALESCE(actor.username, '') AS actor_username,
          COALESCE(actor.display_name, '') AS actor_display_name,
          l.target_user_id,
          COALESCE(target.display_name, '') AS target_display_name,
          l.comment,
          l.created_at
        FROM process_card_approval_logs l
        LEFT JOIN users actor ON actor.id = l.actor_user_id
        LEFT JOIN users target ON target.id = l.target_user_id
        WHERE l.card_id = ?
        ORDER BY l.created_at ASC
      `,
      [cardId],
    );

    return rows.map(toApprovalLog);
  }

  private getUserDisplayName(userId: string) {
    if (!userId.trim()) {
      return '';
    }

    const [row] = this.sqlite.query<{ display_name: string }>(
      'SELECT display_name FROM users WHERE id = ?',
      [userId],
    );
    return row?.display_name ?? '';
  }

  private toPayload(
    card: CardRow,
    definitions: OperationDefinition[],
    operationRows: OperationRow[],
    optionRows: SelectedOptionRow[],
    detailRows: DetailRow[],
    approvalLogs: ApprovalLog[],
    viewer: AuthUser | null,
  ): ProcessCardPayload {
    return {
      id: card.id,
      cardNo: card.card_no,
      planNumber: card.plan_number,
      customerCode: card.customer_code,
      orderDate: card.order_date,
      productName: card.product_name,
      material: card.material,
      specification: card.specification,
      lengthTolerance: card.length_tolerance ?? '',
      quantity: card.quantity,
      deliveryDate: card.delivery_date,
      deliveryStatus: card.delivery_status,
      standard: card.standard,
      technicalRequirements: card.technical_requirements,
      remark: card.remark,
      preparedBy: card.prepared_by,
      preparedDate: card.prepared_date,
      confirmedBy: card.confirmed_by,
      confirmedDate: card.confirmed_date,
      reviewedBy: card.reviewed_by,
      reviewedDate: card.reviewed_date,
      approvedBy: card.approved_by,
      approvedDate: card.approved_date,
      status: card.status,
      currentStep: card.current_step,
      currentHandlerUserId: card.current_handler_user_id,
      currentHandlerName: this.getUserDisplayName(card.current_handler_user_id),
      createdByUserId: card.created_by_user_id,
      createdByName: this.getUserDisplayName(card.created_by_user_id),
      confirmedUserId: card.confirmed_user_id,
      reviewedUserId: card.reviewed_user_id,
      approvedUserId: card.approved_user_id,
      versionNo: card.version_no,
      sourceCardId: card.source_card_id,
      submittedAt: card.submitted_at,
      lockedAt: card.locked_at,
      lastReturnComment: card.last_return_comment,
      approvalLogs,
      permissions: getPermissions(card, viewer),
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      operations: definitions.map((definition) => {
        const saved = operationRows.find((item) => item.operation_code === definition.code);
        if (!saved) {
          return createEmptyOperation(definition);
        }

        const selectedOptionCodes = optionRows
          .filter((item) => item.card_operation_id === saved.id)
          .map((item) => item.option_code);

        const details = detailRows
          .filter((item) => item.card_operation_id === saved.id)
          .sort((left, right) => left.detail_seq - right.detail_seq)
          .map<OperationDetail>((item) => ({
            id: item.id,
            detailSeq: item.detail_seq,
            detailType: item.detail_type,
            displayText: item.display_text,
            params: JSON.parse(item.params_json),
          }));

        return {
          id: saved.id,
          operationCode: saved.operation_code,
          sortOrder: saved.sort_order,
          enabled: Boolean(saved.enabled),
          customName: saved.custom_name || '',
          department: saved.department,
          specialCharacteristic: saved.special_characteristic || '',
          deliveryTime: saved.delivery_time,
          otherRequirements: saved.other_requirements,
          remark: saved.remark,
          selectedOptionCodes,
          details: details.length > 0 ? details : createEmptyOperation(definition).details,
        } satisfies CardOperation;
      }),
    };
  }

  async listProcessCards(filters: ProcessCardListFilters, viewer: AuthUser): Promise<ProcessCardListItem[]> {
    const whereClauses = ['1 = 1'];
    const params: string[] = [];

    const appendLike = (column: string, value?: string) => {
      if (!value?.trim()) {
        return;
      }
      whereClauses.push(`${column} LIKE ?`);
      params.push(`%${value.trim()}%`);
    };

    appendLike(
      '(c.plan_number || c.customer_code || c.product_name || c.material || c.specification)',
      filters.keyword,
    );
    appendLike('c.plan_number', filters.planNumber);
    appendLike('c.customer_code', filters.customerCode);
    appendLike('c.product_name', filters.productName);
    appendLike('c.material', filters.material);
    appendLike('c.specification', filters.specification);
    appendLike('c.delivery_date', filters.deliveryDate);

    if (filters.status?.trim()) {
      whereClauses.push('c.status = ?');
      params.push(filters.status.trim());
    }

    if (filters.operationCode?.trim()) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM card_operations co2
          WHERE co2.card_id = c.id
            AND co2.operation_code = ?
            AND co2.enabled = 1
        )
      `);
      params.push(filters.operationCode.trim());
    }

    if (filters.heatTreatmentType?.trim()) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM card_operations co3
          JOIN operation_details od3 ON od3.card_operation_id = co3.id
          WHERE co3.card_id = c.id
            AND co3.operation_code = 'heat-treatment'
            AND od3.detail_type = ?
        )
      `);
      params.push(filters.heatTreatmentType.trim());
    }

    const rows = this.sqlite.query<
      CardRow & {
        current_handler_name: string;
        enabled_operation_codes?: string;
        heat_treatment_types?: string;
      }
    >(
      `
        SELECT
          c.*,
          COALESCE(handler.display_name, '') AS current_handler_name,
          GROUP_CONCAT(DISTINCT co.operation_code) AS enabled_operation_codes,
          GROUP_CONCAT(DISTINCT CASE WHEN co.operation_code = 'heat-treatment' THEN od.detail_type END) AS heat_treatment_types
        FROM process_cards c
        LEFT JOIN users handler ON handler.id = c.current_handler_user_id
        LEFT JOIN card_operations co ON co.card_id = c.id AND co.enabled = 1
        LEFT JOIN operation_details od ON od.card_operation_id = co.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      cardNo: row.card_no,
      planNumber: row.plan_number,
      customerCode: row.customer_code,
      productName: row.product_name,
      material: row.material,
      specification: row.specification,
      deliveryDate: row.delivery_date,
      updatedAt: row.updated_at,
      status: row.status,
      currentStep: row.current_step,
      currentHandlerName: row.current_handler_name,
      versionNo: row.version_no,
      lastReturnComment: row.last_return_comment,
      enabledOperationCodes: csvToArray(row.enabled_operation_codes),
      heatTreatmentTypes: csvToArray(row.heat_treatment_types),
      permissions: {
        canEdit: getPermissions(row, viewer).canEdit,
        canDelete: getPermissions(row, viewer).canDelete,
      },
    }));
  }

  async getProcessCard(id: string, viewer: AuthUser | null = null) {
    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [id]);
    if (!card) {
      return null;
    }

    const definitions = await this.getOperationDefinitions();
    const { operationRows, selectedOptionRows, detailRows } = await this.getOperationRecords(id);
    const approvalLogs = this.getApprovalLogs(id);
    return this.toPayload(
      card,
      definitions,
      operationRows,
      selectedOptionRows,
      detailRows,
      approvalLogs,
      viewer,
    );
  }

  async findProductPrefills(productName: string): Promise<ProductPrefillCandidate[]> {
    const normalized = productName.trim();
    if (!normalized) {
      return [];
    }

    const cards = this.sqlite.query<CardRow>(
      `
        SELECT *
        FROM process_cards
        WHERE TRIM(product_name) = ?
        ORDER BY updated_at DESC
      `,
      [normalized],
    );

    const definitions = await this.getOperationDefinitions();

    return Promise.all(
      cards.map(async (card) => {
        const { operationRows, selectedOptionRows, detailRows } = await this.getOperationRecords(card.id);
        const payload = this.toPayload(
          card,
          definitions,
          operationRows,
          selectedOptionRows,
          detailRows,
          [],
          null,
        );

        return {
          sourceCardId: card.id,
          productName: payload.productName,
          planNumber: payload.planNumber,
          updatedAt: payload.updatedAt ?? card.updated_at,
          operations: payload.operations.map((operation) => ({
            ...operation,
            id: undefined,
            details: operation.details.map((detail) => ({
              ...detail,
              id: undefined,
            })),
          })),
        };
      }),
    );
  }

  private assertCanEditCard(card: CardRow, actor: AuthUser) {
    if (!getPermissions(card, actor).canEdit) {
      throw new Error('当前状态下你没有编辑这张工艺卡的权限。');
    }
  }

  private writeOperations(cardId: string, operations: CardOperation[]) {
    this.sqlite.run('DELETE FROM card_operations WHERE card_id = ?', [cardId]);

    for (const operation of operations
      .filter(hasMeaningfulOperationContent)
      .sort((a, b) => a.sortOrder - b.sortOrder)) {
      const operationId = randomUUID();
      this.sqlite.run(
        `
          INSERT INTO card_operations
          (id, card_id, operation_code, sort_order, enabled, custom_name, department, special_characteristic, delivery_time, other_requirements, remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          operationId,
          cardId,
          operation.operationCode,
          operation.sortOrder,
          operation.enabled ? 1 : 0,
          operation.customName,
          operation.department,
          operation.specialCharacteristic,
          operation.deliveryTime,
          operation.otherRequirements,
          '',
        ],
      );

      for (const optionCode of operation.selectedOptionCodes) {
        this.sqlite.run(
          'INSERT INTO card_operation_selected_options (id, card_operation_id, option_code) VALUES (?, ?, ?)',
          [randomUUID(), operationId, optionCode],
        );
      }

      for (const detail of operation.details) {
        const hasValues =
          detail.detailType.trim() || Object.values(detail.params).some((value) => value.trim());
        if (!hasValues && !operation.enabled) {
          continue;
        }

        this.sqlite.run(
          `
            INSERT INTO operation_details
            (id, card_operation_id, detail_seq, detail_type, display_text, params_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            operationId,
            detail.detailSeq,
            detail.detailType,
            detail.displayText ?? '',
            JSON.stringify(detail.params),
          ],
        );
      }
    }
  }

  async saveProcessCard(input: ProcessCardPayload, actor: AuthUser, ipAddress = '') {
    const parsed = processCardSchema.parse(input);
    const payload = {
      ...parsed,
      cardNo: '',
      remark: FIXED_REMARK,
      operations: parsed.operations.map((operation) => ({
        ...operation,
        remark: '',
      })),
    };
    this.validateProcessCardRequiredFields(payload);
    this.assertWorkflowAssigneeExists(payload.confirmedUserId, '确认人');
    this.assertWorkflowAssigneeExists(payload.reviewedUserId, '审核人');
    this.assertWorkflowAssigneeExists(payload.approvedUserId, '批准人');
    const now = new Date().toISOString();
    const cardId = payload.id ?? randomUUID();
    const beforePayload = payload.id ? await this.getProcessCard(payload.id, null) : null;
    const isNewCard = !payload.id;

    this.sqlite.transaction(() => {
      const [existing] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [cardId]);

      if (existing) {
        this.assertCanEditCard(existing, actor);
        this.sqlite.run(
          `
            UPDATE process_cards SET
              card_no = ?, plan_number = ?, customer_code = ?, order_date = ?, product_name = ?, material = ?,
              specification = ?, length_tolerance = ?, quantity = ?, delivery_date = ?, delivery_status = ?, standard = ?,
              technical_requirements = ?, remark = ?, confirmed_user_id = ?, reviewed_user_id = ?, approved_user_id = ?,
              updated_at = ?
            WHERE id = ?
          `,
          [
            '',
            payload.planNumber,
            payload.customerCode,
            payload.orderDate,
            payload.productName,
            payload.material,
            payload.specification,
            payload.lengthTolerance,
            payload.quantity,
            payload.deliveryDate,
            payload.deliveryStatus,
            payload.standard,
            payload.technicalRequirements,
            FIXED_REMARK,
            payload.confirmedUserId,
            payload.reviewedUserId,
            payload.approvedUserId,
            now,
            cardId,
          ],
        );
      } else {
        if (!hasWorkflowRole(actor, 'prepare')) {
          throw new Error('只有具备编制权限的账号才能新建工艺卡。');
        }

        this.sqlite.run(
          `
            INSERT INTO process_cards
            (id, card_no, plan_number, customer_code, order_date, product_name, material, specification, length_tolerance, quantity,
             delivery_date, delivery_status, standard, technical_requirements, remark, prepared_by, prepared_date,
             confirmed_by, confirmed_date, reviewed_by, reviewed_date, approved_by, approved_date, status, current_step,
             current_handler_user_id, created_by_user_id, confirmed_user_id, reviewed_user_id, approved_user_id, submitted_at,
             locked_at, version_no, source_card_id, last_return_comment, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            cardId,
            '',
            payload.planNumber,
            payload.customerCode,
            payload.orderDate,
            payload.productName,
            payload.material,
            payload.specification,
            payload.lengthTolerance,
            payload.quantity,
            payload.deliveryDate,
            payload.deliveryStatus,
            payload.standard,
            payload.technicalRequirements,
            FIXED_REMARK,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'draft',
            'prepare',
            actor.id,
            actor.id,
            payload.confirmedUserId,
            payload.reviewedUserId,
            payload.approvedUserId,
            '',
            '',
            1,
            payload.sourceCardId ?? '',
            '',
            now,
            now,
          ],
        );
      }

      this.writeOperations(cardId, payload.operations);
    });

    await this.sqlite.persist();
    const saved = await this.getProcessCard(cardId, actor);
    if (!saved) {
      throw new Error('保存后的工艺卡读取失败。');
    }

    const changes = buildProcessCardChanges(beforePayload, saved);
    this.writeAuditLog({
      category: 'process_card',
      entityType: 'process_card',
      entityId: cardId,
      action: isNewCard ? 'create' : 'update',
      actor,
      summary: `${isNewCard ? '新建' : '编辑'}工艺卡：${saved.planNumber || saved.productName || cardId}`,
      detailText: isNewCard ? '创建了一张新的工艺卡。' : '保存了工艺卡修改。',
      changes,
      ipAddress,
    });
    await this.sqlite.persist();
    return saved;
  }

  async performApprovalAction(cardId: string, request: ApprovalActionRequest, actor: AuthUser, ipAddress = '') {
    const payload = approvalActionSchema.parse(request);
    const comment = payload.comment?.trim() ?? '';
    requireCommentForAction(payload.action, comment);

    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [cardId]);
    if (!card) {
      throw new Error('工艺卡不存在。');
    }

    if (!getAvailableActions(card, actor).includes(payload.action)) {
      throw new Error('当前状态下你没有执行此流程动作的权限。');
    }

    if (payload.action === 'submit_confirm' && !card.confirmed_user_id.trim()) {
      throw new Error('请先指定确认人后再提交确认。');
    }
    if (payload.action === 'submit_review' && !card.reviewed_user_id.trim()) {
      throw new Error('请先指定审核人后再提交审核。');
    }
    if (payload.action === 'submit_approve' && !card.approved_user_id.trim()) {
      throw new Error('请先指定批准人后再提交批准。');
    }

    const next = getActionResult(card, payload.action, comment, actor);

    this.sqlite.transaction(() => {
      this.sqlite.run(
        `
          UPDATE process_cards
          SET status = ?, current_step = ?, current_handler_user_id = ?, submitted_at = ?, locked_at = ?,
              prepared_by = ?, prepared_date = ?, confirmed_by = ?, confirmed_date = ?,
              reviewed_by = ?, reviewed_date = ?, approved_by = ?, approved_date = ?,
              last_return_comment = ?, updated_at = ?
          WHERE id = ?
        `,
        [
          next.status,
          next.current_step,
          next.current_handler_user_id,
          next.submitted_at,
          next.locked_at,
          next.prepared_by,
          next.prepared_date,
          next.confirmed_by,
          next.confirmed_date,
          next.reviewed_by,
          next.reviewed_date,
          next.approved_by,
          next.approved_date,
          next.last_return_comment,
          next.updated_at,
          cardId,
        ],
      );

      this.sqlite.run(
        `
          INSERT INTO process_card_approval_logs
          (id, card_id, action, from_status, to_status, actor_user_id, target_user_id, comment, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          cardId,
          payload.action,
          card.status,
          next.status,
          actor.id,
          getTargetUserIdForAction(card, payload.action),
          comment,
          new Date().toISOString(),
        ],
      );

      this.writeAuditLog({
        category: 'approval',
        entityType: 'process_card',
        entityId: cardId,
        action: payload.action,
        actor,
        targetUserId: getTargetUserIdForAction(card, payload.action),
        targetDisplayName: this.getUserDisplayName(getTargetUserIdForAction(card, payload.action)),
        summary: `审批动作：${payload.action} -> ${card.plan_number || card.product_name || cardId}`,
        detailText: comment,
        changes: [
          {
            field: '流程状态',
            before: card.status,
            after: next.status,
          },
        ],
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getProcessCard(cardId, actor);
  }

  async voidProcessCard(id: string, actor: AuthUser, ipAddress = '') {
    if (!isAdmin(actor)) {
      throw new Error('仅管理员可以作废工艺卡。');
    }

    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [id]);
    if (!card) {
      throw new Error('工艺卡不存在。');
    }

    if (card.status === 'voided') {
      return this.getProcessCard(id, actor);
    }

    const now = new Date().toISOString();
    this.sqlite.transaction(() => {
      this.sqlite.run(
        `
          UPDATE process_cards
          SET status = ?, current_handler_user_id = ?, locked_at = ?, updated_at = ?
          WHERE id = ?
        `,
        ['voided', '', now, now, id],
      );
      this.writeAuditLog({
        category: 'process_card',
        entityType: 'process_card',
        entityId: id,
        action: 'void',
        actor,
        summary: `作废工艺卡：${card.plan_number || card.product_name || id}`,
        detailText: '管理员作废了该工艺卡。',
        changes: [
          { field: '流程状态', before: card.status, after: 'voided' },
        ],
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return this.getProcessCard(id, actor);
  }

  async forceDeleteProcessCard(id: string, actor: AuthUser, ipAddress = '') {
    if (!isAdmin(actor)) {
      throw new Error('仅管理员可以强制删除工艺卡。');
    }

    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [id]);
    if (!card) {
      return { success: true };
    }

    this.sqlite.transaction(() => {
      this.sqlite.run('DELETE FROM process_cards WHERE id = ?', [id]);
      this.writeAuditLog({
        category: 'process_card',
        entityType: 'process_card',
        entityId: id,
        action: 'force_delete',
        actor,
        summary: `强制删除工艺卡：${card.plan_number || card.product_name || id}`,
        detailText: '管理员强制删除了该工艺卡。',
        changes: [
          { field: '计划单号', before: card.plan_number || '-', after: '-' },
          { field: '产品名称', before: card.product_name || '-', after: '-' },
          { field: '流程状态', before: card.status, after: '-' },
        ],
        ipAddress,
      });
    });

    await this.sqlite.persist();
    return { success: true };
  }

  async deleteProcessCard(id: string, actor: AuthUser, ipAddress = '') {
    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [id]);
    if (!card) {
      return;
    }

    if (!getPermissions(card, actor).canDelete) {
      throw new Error('当前状态下你没有删除这张工艺卡的权限。');
    }

    this.sqlite.transaction(() => {
      this.sqlite.run('DELETE FROM process_cards WHERE id = ?', [id]);
      this.writeAuditLog({
        category: 'process_card',
        entityType: 'process_card',
        entityId: id,
        action: 'delete',
        actor,
        summary: `删除工艺卡：${card.plan_number || card.product_name || id}`,
        detailText: '',
        changes: [
          { field: '计划单号', before: card.plan_number || '-', after: '-' },
          { field: '产品名称', before: card.product_name || '-', after: '-' },
        ],
        ipAddress,
      });
    });
    await this.sqlite.persist();
  }

  async buildBatchExport(request: BatchExportRequest) {
    const payload = z.object({ ids: z.array(z.string()).min(1) }).parse(request);
    const cards = await Promise.all(payload.ids.map((id) => this.getProcessCard(id, null)));
    return cards
      .filter((card): card is ProcessCardPayload => Boolean(card))
      .map((card) => ({
        id: card.id ?? '',
        planNumber: card.planNumber,
        printUrl: `/cards/${card.id}/print`,
        exportHint: '请在打印预览页中使用浏览器“另存为 PDF”导出。',
      }));
  }
}

export const repository = new ProcessCardRepository();
