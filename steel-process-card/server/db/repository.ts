import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { SqliteService } from './sqlite';
import { createDemoProcessCard, createEmptyOperation, PROCESS_CATALOG } from '../../shared/process-catalog';
import type {
  AuthUser,
  BatchExportRequest,
  CardOperation,
  DepartmentOption,
  LoginResponse,
  OperationDefinition,
  OperationDetail,
  ProcessCardListFilters,
  ProcessCardListItem,
  ProcessCardPayload,
  ProductPrefillCandidate,
  UserRole,
} from '../../shared/types';
import { DEFAULT_DEPARTMENT_OPTIONS, FIXED_REMARK } from '../../shared/types';

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
  operations: z.array(
    z.object({
      id: z.string().optional(),
      operationCode: z.string(),
      sortOrder: z.number().int(),
      enabled: z.boolean(),
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

type CardRow = {
  id: string;
  card_no: string;
  plan_number: string;
  customer_code: string;
  order_date: string;
  product_name: string;
  material: string;
  specification: string;
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
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

type SessionUserRow = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  token?: string;
  expires_at?: string;
};

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

const toAuthUser = (row: SessionUserRow | UserRow): AuthUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  role: row.role,
});

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const toPayload = (
  card: CardRow,
  definitions: OperationDefinition[],
  operationRows: OperationRow[],
  optionRows: SelectedOptionRow[],
  detailRows: DetailRow[],
): ProcessCardPayload => ({
  id: card.id,
  cardNo: card.card_no,
  planNumber: card.plan_number,
  customerCode: card.customer_code,
  orderDate: card.order_date,
  productName: card.product_name,
  material: card.material,
  specification: card.specification,
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
      department: saved.department,
      specialCharacteristic: saved.special_characteristic || '',
      deliveryTime: saved.delivery_time,
      otherRequirements: saved.other_requirements,
      remark: saved.remark,
      selectedOptionCodes,
      details: details.length > 0 ? details : createEmptyOperation(definition).details,
    } satisfies CardOperation;
  }),
});

export class ProcessCardRepository {
  private readonly sqlite = new SqliteService(
    path.join(process.cwd(), 'server', 'data', 'process-cards.sqlite'),
  );

  async init() {
    await this.sqlite.init();
    const schema = await readFile(path.join(process.cwd(), 'server', 'db', 'schema.sql'), 'utf8');
    this.sqlite.exec(schema);
    this.seedDefinitions();
    this.seedDepartmentOptions();
    this.seedUsers();
    await this.seedDemoCard();
    await this.sqlite.persist();
  }

  private seedDefinitions() {
    this.sqlite.transaction(() => {
      for (const definition of PROCESS_CATALOG) {
        this.sqlite.run(
          `
            INSERT OR REPLACE INTO operation_definitions
            (code, name, default_order, detail_mode, allows_multiple_details, detail_label, field_config_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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

        this.sqlite.run(
          `
            DELETE FROM operation_option_definitions
            WHERE operation_code = ?
          `,
          [definition.code],
        );

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

    if (storedBuffer.length !== computedHash.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, computedHash);
  }

  private seedUsers() {
    const [{ count }] = this.sqlite.query<{ count: number }>('SELECT COUNT(*) AS count FROM users');

    if (count > 0) {
      return;
    }

    const now = new Date().toISOString();
    const users = [
      {
        username: 'admin',
        displayName: '系统管理员',
        password: 'admin123',
        role: 'admin' as const,
      },
      {
        username: 'operator',
        displayName: '工艺录入员',
        password: 'operator123',
        role: 'user' as const,
      },
    ];

    this.sqlite.transaction(() => {
      users.forEach((user) => {
        this.sqlite.run(
          `
            INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            randomUUID(),
            user.username,
            user.displayName,
            this.hashPassword(user.password),
            user.role,
            now,
            now,
          ],
        );
      });
    });
  }

  private async seedDemoCard() {
    const [{ count }] = this.sqlite.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM process_cards',
    );

    if (count > 0) {
      return;
    }

    await this.saveProcessCard(createDemoProcessCard(await this.getOperationDefinitions()));
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

  async saveDepartmentOptions(input: DepartmentOption[]) {
    const items = departmentOptionListSchema.parse(input);
    const now = new Date().toISOString();

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
    });

    await this.sqlite.persist();
    return this.getDepartmentOptions();
  }

  async login(username: string, password: string): Promise<LoginResponse | null> {
    const normalizedUsername = username.trim().toLowerCase();
    const [user] = this.sqlite.query<UserRow>(
      `
        SELECT id, username, display_name, password_hash, role, created_at, updated_at
        FROM users
        WHERE username = ?
      `,
      [normalizedUsername],
    );

    if (!user || !this.verifyPassword(password, user.password_hash)) {
      return null;
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

    await this.sqlite.persist();

    return {
      token,
      user: toAuthUser(user),
    };
  }

  async getAuthUserByToken(token: string): Promise<AuthUser | null> {
    const now = new Date().toISOString();
    const [row] = this.sqlite.query<SessionUserRow>(
      `
        SELECT u.id, u.username, u.display_name, u.role, s.token, s.expires_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?
      `,
      [token, now],
    );

    if (!row) {
      return null;
    }

    return toAuthUser(row);
  }

  async logout(token: string) {
    this.sqlite.run('DELETE FROM sessions WHERE token = ?', [token]);
    await this.sqlite.persist();
  }

  async listProcessCards(filters: ProcessCardListFilters): Promise<ProcessCardListItem[]> {
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

    const rows = this.sqlite.query<{
      id: string;
      card_no: string;
      plan_number: string;
      customer_code: string;
      product_name: string;
      material: string;
      specification: string;
      delivery_date: string;
      updated_at: string;
      enabled_operation_codes?: string;
      heat_treatment_types?: string;
    }>(
      `
        SELECT
          c.id,
          c.card_no,
          c.plan_number,
          c.customer_code,
          c.product_name,
          c.material,
          c.specification,
          c.delivery_date,
          c.updated_at,
          GROUP_CONCAT(DISTINCT co.operation_code) AS enabled_operation_codes,
          GROUP_CONCAT(DISTINCT CASE WHEN co.operation_code = 'heat-treatment' THEN od.detail_type END) AS heat_treatment_types
        FROM process_cards c
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
      enabledOperationCodes: csvToArray(row.enabled_operation_codes),
      heatTreatmentTypes: csvToArray(row.heat_treatment_types),
    }));
  }

  async getProcessCard(id: string) {
    const [card] = this.sqlite.query<CardRow>('SELECT * FROM process_cards WHERE id = ?', [id]);
    if (!card) {
      return null;
    }

    const definitions = await this.getOperationDefinitions();
    const operationRows = this.sqlite.query<OperationRow>(
      'SELECT * FROM card_operations WHERE card_id = ? ORDER BY sort_order ASC',
      [id],
    );
    const selectedOptionRows = this.sqlite.query<SelectedOptionRow>(
      `
        SELECT card_operation_id, option_code
        FROM card_operation_selected_options
        WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
      `,
      [id],
    );
    const detailRows = this.sqlite.query<DetailRow>(
      `
        SELECT * FROM operation_details
        WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
        ORDER BY detail_seq ASC
      `,
      [id],
    );

    return toPayload(card, definitions, operationRows, selectedOptionRows, detailRows);
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

    if (cards.length === 0) {
      return [];
    }

    const definitions = await this.getOperationDefinitions();

    return cards.map((card) => {
      const operationRows = this.sqlite.query<OperationRow>(
        'SELECT * FROM card_operations WHERE card_id = ? ORDER BY sort_order ASC',
        [card.id],
      );
      const selectedOptionRows = this.sqlite.query<SelectedOptionRow>(
        `
          SELECT card_operation_id, option_code
          FROM card_operation_selected_options
          WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
        `,
        [card.id],
      );
      const detailRows = this.sqlite.query<DetailRow>(
        `
          SELECT *
          FROM operation_details
          WHERE card_operation_id IN (SELECT id FROM card_operations WHERE card_id = ?)
          ORDER BY detail_seq ASC
        `,
        [card.id],
      );

      const payload = toPayload(card, definitions, operationRows, selectedOptionRows, detailRows);

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
    });
  }

  async saveProcessCard(input: ProcessCardPayload) {
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
    const cardId = payload.id ?? randomUUID();
    const now = new Date().toISOString();

    this.sqlite.transaction(() => {
      const exists = this.sqlite.query<{ id: string }>(
        'SELECT id FROM process_cards WHERE id = ?',
        [cardId],
      )[0];

      if (exists) {
        this.sqlite.run(
          `
            UPDATE process_cards SET
              card_no = ?, plan_number = ?, customer_code = ?, order_date = ?, product_name = ?, material = ?,
              specification = ?, quantity = ?, delivery_date = ?, delivery_status = ?, standard = ?,
              technical_requirements = ?, remark = ?, prepared_by = ?, prepared_date = ?, confirmed_by = ?,
              confirmed_date = ?, reviewed_by = ?, reviewed_date = ?, approved_by = ?, approved_date = ?, updated_at = ?
            WHERE id = ?
          `,
          [
            payload.cardNo,
            payload.planNumber,
            payload.customerCode,
            payload.orderDate,
            payload.productName,
            payload.material,
            payload.specification,
            payload.quantity,
            payload.deliveryDate,
            payload.deliveryStatus,
            payload.standard,
            payload.technicalRequirements,
            payload.remark,
            payload.preparedBy,
            payload.preparedDate,
            payload.confirmedBy,
            payload.confirmedDate,
            payload.reviewedBy,
            payload.reviewedDate,
            payload.approvedBy,
            payload.approvedDate,
            now,
            cardId,
          ],
        );
        this.sqlite.run('DELETE FROM card_operations WHERE card_id = ?', [cardId]);
      } else {
        this.sqlite.run(
          `
            INSERT INTO process_cards
            (id, card_no, plan_number, customer_code, order_date, product_name, material, specification, quantity,
             delivery_date, delivery_status, standard, technical_requirements, remark, prepared_by, prepared_date,
             confirmed_by, confirmed_date, reviewed_by, reviewed_date, approved_by, approved_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            cardId,
            payload.cardNo,
            payload.planNumber,
            payload.customerCode,
            payload.orderDate,
            payload.productName,
            payload.material,
            payload.specification,
            payload.quantity,
            payload.deliveryDate,
            payload.deliveryStatus,
            payload.standard,
            payload.technicalRequirements,
            payload.remark,
            payload.preparedBy,
            payload.preparedDate,
            payload.confirmedBy,
            payload.confirmedDate,
            payload.reviewedBy,
            payload.reviewedDate,
            payload.approvedBy,
            payload.approvedDate,
            now,
            now,
          ],
        );
      }

      for (const operation of payload.operations
        .filter(hasMeaningfulOperationContent)
        .sort((a, b) => a.sortOrder - b.sortOrder)) {
        const operationId = randomUUID();
        this.sqlite.run(
          `
            INSERT INTO card_operations
            (id, card_id, operation_code, sort_order, enabled, department, special_characteristic, delivery_time, other_requirements, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            operationId,
            cardId,
            operation.operationCode,
            operation.sortOrder,
            operation.enabled ? 1 : 0,
            operation.department,
            operation.specialCharacteristic,
            operation.deliveryTime,
            operation.otherRequirements,
            operation.remark,
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
    });

    await this.sqlite.persist();
    return this.getProcessCard(cardId);
  }

  async deleteProcessCard(id: string) {
    this.sqlite.run('DELETE FROM process_cards WHERE id = ?', [id]);
    await this.sqlite.persist();
  }

  async buildBatchExport(request: BatchExportRequest) {
    const payload = z.object({ ids: z.array(z.string()).min(1) }).parse(request);
    const cards = await Promise.all(payload.ids.map((id) => this.getProcessCard(id)));
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
