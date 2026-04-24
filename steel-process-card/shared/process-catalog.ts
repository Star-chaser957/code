import type {
  CardPermissions,
  CardOperation,
  OperationDefinition,
  OperationDetail,
  ProcessCardPayload,
} from './types';
import { FIXED_REMARK } from './types';

const createOptions = (operationCode: string, options: string[]) =>
  options.map((label, index) => ({
    operationCode,
    optionCode: `${operationCode}-${index + 1}`,
    label,
    sortOrder: index + 1,
  }));

const shapingFieldConfig = [
  {
    key: 'type',
    label: '类型',
    inputType: 'select' as const,
    options: ['圆钢/圆棒', '扁钢', '方钢', '六角钢', '八角钢', '钢管', '等边角钢', '螺纹钢'],
  },
  { key: 'diameterOrSideLength', label: '直径/边长（mm）' },
  { key: 'length', label: '长度（mm）' },
];

export const PROCESS_CATALOG: OperationDefinition[] = [
  {
    code: 'material-source',
    name: '材料来源',
    defaultOrder: 5,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'batchNo', label: '批号' },
      { key: 'count', label: '支数（支）' },
      { key: 'specification', label: '规格' },
      { key: 'weight', label: '重量（kg）' },
      { key: 'length', label: '长度（mm）' },
    ],
    optionCatalog: createOptions('material-source', ['库存', '外购']),
  },
  {
    code: 'steelmaking',
    name: '炼钢',
    defaultOrder: 10,
    detailMode: 'multiSelect',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'ingotType', label: '锭型' },
      { key: 'count', label: '支数（支）' },
      { key: 'weight', label: '重量（kg）' },
      { key: 'composition', label: '成分' },
    ],
    optionCatalog: createOptions('steelmaking', [
      '非真空感应炉',
      '非真空感应炉+AOD',
      '真空感应炉',
      '电渣',
    ]),
  },
  {
    code: 'blooming',
    name: '开坯',
    defaultOrder: 20,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'type', label: '类型', inputType: 'select', options: ['方坯', '圆坯'] },
      { key: 'diameter', label: '直径/边长（mm）' },
      { key: 'length', label: '长度（mm）' },
    ],
    optionCatalog: createOptions('blooming', ['热轧', '热锻']),
  },
  {
    code: 'sawing',
    name: '锯床',
    defaultOrder: 30,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'length', label: '长度（mm）' },
      { key: 'weight', label: '重量（kg）' },
      { key: 'count', label: '支数（支）' },
    ],
    optionCatalog: [],
  },
  {
    code: 'grinding-repair',
    name: '修磨',
    defaultOrder: 40,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'appearance', label: '外观' }],
    optionCatalog: createOptions('grinding-repair', ['点修', '全抛', '其他']),
  },
  {
    code: 'rolling',
    name: '轧制',
    defaultOrder: 50,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: shapingFieldConfig,
    optionCatalog: [],
  },
  {
    code: 'forging',
    name: '锻造',
    defaultOrder: 55,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: shapingFieldConfig,
    optionCatalog: [],
  },
  {
    code: 'finishing',
    name: '精整',
    defaultOrder: 60,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'diameter', label: '直径（mm）' },
      { key: 'length', label: '长度（mm）' },
      { key: 'appearance', label: '外观' },
    ],
    optionCatalog: [],
  },
  {
    code: 'pickling',
    name: '酸洗',
    defaultOrder: 70,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'appearance', label: '外观' }],
    optionCatalog: [],
  },
  {
    code: 'heat-treatment',
    name: '热处理',
    defaultOrder: 80,
    detailMode: 'multiple',
    allowsMultipleDetails: true,
    detailLabel: '处理明细',
    fieldConfig: [
      {
        key: 'heatingTemperature',
        label: '加热温度（℃）',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'heatingDuration',
        label: '加热时长（h）',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'holdingTemperature',
        label: '保温温度（℃）',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'holdingDuration',
        label: '保温时长（h）',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'coolingMethod',
        label: '冷却方式',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'performance',
        label: '性能',
        hideForDetailTypes: ['其他'],
      },
      {
        key: 'otherRequirement',
        label: '其他要求',
        inputType: 'textarea',
        showForDetailTypes: ['其他'],
      },
    ],
    optionCatalog: createOptions('heat-treatment', ['退火', '固溶', '调质', '时效', '其他']),
  },
  {
    code: 'straightening',
    name: '矫直',
    defaultOrder: 90,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'straightness', label: '直线度' }],
    optionCatalog: [],
  },
  {
    code: 'peeling',
    name: '剥皮',
    defaultOrder: 100,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'diameter', label: '直径（mm）' },
      { key: 'appearance', label: '外观' },
    ],
    optionCatalog: [],
  },
  {
    code: 'cold-drawing',
    name: '冷拉',
    defaultOrder: 110,
    detailMode: 'multiSelect',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'diameter', label: '直径（mm）' },
      { key: 'appearance', label: '外观' },
      { key: 'performance', label: '性能' },
    ],
    optionCatalog: createOptions('cold-drawing', ['喷丸', '焊接', '拉拔', '切断']),
  },
  {
    code: 'burnishing',
    name: '压光',
    defaultOrder: 120,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'diameter', label: '直径（mm）' },
      { key: 'straightness', label: '直线度' },
    ],
    optionCatalog: [],
  },
  {
    code: 'fixed-length',
    name: '定尺',
    defaultOrder: 130,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'length', label: '长度（mm）' }],
    optionCatalog: [],
  },
  {
    code: 'polishing',
    name: '抛光',
    defaultOrder: 140,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'diameter', label: '直径（mm）' },
      { key: 'roughness', label: '粗糙度（μm）' },
    ],
    optionCatalog: [],
  },
  {
    code: 'chamfering',
    name: '倒角',
    defaultOrder: 150,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'cAngle', label: 'C角' }],
    optionCatalog: [],
  },
  {
    code: 'grinding',
    name: '研磨',
    defaultOrder: 160,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [
      { key: 'passes', label: '研磨道次' },
      { key: 'diameter', label: '直径（mm）' },
      { key: 'roughness', label: '粗糙度≤（μm）' },
      { key: 'straightness', label: '直线度≤（mm/m）' },
    ],
    optionCatalog: [],
  },
  {
    code: 'testing',
    name: '探伤',
    defaultOrder: 170,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'defectLevel', label: '缺陷等级' }],
    optionCatalog: createOptions('testing', ['UT（手持/自动）', '其他']),
  },
  {
    code: 'inspection',
    name: '检验',
    defaultOrder: 180,
    detailMode: 'checklist',
    allowsMultipleDetails: false,
    detailLabel: '检验项目',
    fieldConfig: [],
    optionCatalog: createOptions('inspection', [
      '成分',
      '外观',
      '尺寸',
      '长度',
      '直线度',
      '拉伸四项',
      '硬度',
      '冲击',
      '晶粒度',
      '其他',
    ]),
  },
  {
    code: 'custom-operation-1',
    name: '自定义工序 1',
    defaultOrder: 185,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'productRequirement', label: '产品要求', inputType: 'textarea' }],
    optionCatalog: [],
  },
  {
    code: 'custom-operation-2',
    name: '自定义工序 2',
    defaultOrder: 186,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'productRequirement', label: '产品要求', inputType: 'textarea' }],
    optionCatalog: [],
  },
  {
    code: 'custom-operation-3',
    name: '自定义工序 3',
    defaultOrder: 187,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '产品要求',
    fieldConfig: [{ key: 'productRequirement', label: '产品要求', inputType: 'textarea' }],
    optionCatalog: [],
  },
  {
    code: 'packaging',
    name: '包装',
    defaultOrder: 190,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '包装要求',
    fieldConfig: [
      { key: 'packagingMethod', label: '包装方式' },
      { key: 'protectionRequirement', label: '防护要求' },
      { key: 'packageQuality', label: '包装质量' },
    ],
    optionCatalog: [],
  },
];

export const PROCESS_LOOKUP = Object.fromEntries(PROCESS_CATALOG.map((item) => [item.code, item]));

export const createEmptyDetail = (
  definition: OperationDefinition,
  detailSeq = 1,
  detailType?: string,
): OperationDetail => ({
  detailSeq,
  detailType:
    detailType ?? (definition.detailMode === 'multiple' ? definition.optionCatalog[0]?.label ?? '' : ''),
  params: Object.fromEntries(definition.fieldConfig.map((field) => [field.key, ''])),
});

export const createEmptyOperation = (definition: OperationDefinition): CardOperation => ({
  operationCode: definition.code,
  sortOrder: definition.defaultOrder,
  enabled: false,
  customName: '',
  department: '',
  specialCharacteristic: '',
  deliveryTime: '',
  otherRequirements: '',
  remark: '',
  selectedOptionCodes: [],
  details:
    definition.detailMode === 'checklist' || definition.detailMode === 'multiple'
      ? []
      : [createEmptyDetail(definition)],
});

export const createEmptyProcessCard = (
  definitions: OperationDefinition[] = PROCESS_CATALOG,
): ProcessCardPayload => ({
  cardNo: '',
  planNumber: '',
  customerCode: '',
  orderDate: '',
  productName: '',
  material: '',
  specification: '',
  lengthTolerance: '',
  quantity: '',
  deliveryDate: '',
  deliveryStatus: '',
  standard: '',
  technicalRequirements: '',
  remark: FIXED_REMARK,
  preparedBy: '',
  preparedDate: '',
  confirmedBy: '',
  confirmedDate: '',
  reviewedBy: '',
  reviewedDate: '',
  approvedBy: '',
  approvedDate: '',
  status: 'draft',
  currentStep: 'prepare',
  currentHandlerUserId: '',
  currentHandlerName: '',
  createdByUserId: '',
  createdByName: '',
  confirmedUserId: '',
  reviewedUserId: '',
  approvedUserId: '',
  versionNo: 1,
  sourceCardId: '',
  submittedAt: '',
  lockedAt: '',
  lastReturnComment: '',
  approvalLogs: [],
  permissions: {
    canEdit: true,
    canDelete: true,
    availableActions: [],
  } satisfies CardPermissions,
  operations: definitions.map(createEmptyOperation),
});

export const createDemoProcessCard = (
  definitions: OperationDefinition[] = PROCESS_CATALOG,
): ProcessCardPayload => {
  const card = createEmptyProcessCard(definitions);
  card.cardNo = '';
  card.planNumber = 'JH-20260402-01';
  card.customerCode = 'KH-018';
  card.orderDate = '2026-04-02';
  card.productName = '光亮圆棒';
  card.material = '254SMO';
  card.specification = 'Φ28';
  card.lengthTolerance = '3000±5';
  card.quantity = '800';
  card.deliveryDate = '2026-04-20';
  card.deliveryStatus = '未交货';
  card.standard = '产品技术标准：化学成分按 ASTHA276 标准中 (S31254) 执行';
  card.technicalRequirements = '表面无裂纹、折叠与明显划伤；热处理后满足性能要求。';
  card.preparedBy = '张工';
  card.preparedDate = '2026-04-02';
  card.confirmedBy = '李工';
  card.confirmedDate = '2026-04-02';

  const apply = (code: string, updater: (operation: CardOperation) => void) => {
    const target = card.operations.find((item) => item.operationCode === code);
    if (!target) {
      return;
    }
    target.enabled = true;
    updater(target);
  };

  apply('material-source', (operation) => {
    operation.department = '仓储';
    operation.selectedOptionCodes = ['material-source-1'];
    operation.details = [
      {
        detailSeq: 1,
        detailType: '',
        params: {
          batchNo: 'A20260402',
          count: '40',
          specification: 'Φ28',
          weight: '1000',
          length: '6000',
        },
      },
    ];
  });

  apply('steelmaking', (operation) => {
    operation.department = '炼钢车间';
    operation.specialCharacteristic = 'S';
    operation.selectedOptionCodes = ['steelmaking-2', 'steelmaking-4'];
    operation.details = [
      {
        detailSeq: 1,
        detailType: '',
        params: {
          ingotType: '锭型 1000',
          count: '1',
          weight: '1000',
          composition: '按 254SMO 成分控制',
        },
      },
    ];
  });

  apply('blooming', (operation) => {
    operation.department = '开坯部门';
    operation.selectedOptionCodes = ['blooming-2'];
    operation.details = [
      {
        detailSeq: 1,
        detailType: '',
        params: {
          type: '圆坯',
          diameter: '100',
          length: '1000',
        },
      },
    ];
  });

  apply('heat-treatment', (operation) => {
    operation.department = '热处理';
    operation.specialCharacteristic = '■';
    operation.details = [
      {
        detailSeq: 1,
        detailType: '退火',
        params: {
          heatingTemperature: '720',
          heatingDuration: '2',
          holdingTemperature: '720',
          holdingDuration: '1',
          coolingMethod: '炉冷',
          performance: '组织均匀',
          otherRequirement: '',
        },
      },
      {
        detailSeq: 2,
        detailType: '固溶',
        params: {
          heatingTemperature: '1050',
          heatingDuration: '1.5',
          holdingTemperature: '1050',
          holdingDuration: '1',
          coolingMethod: '水冷',
          performance: '满足耐蚀性能',
          otherRequirement: '',
        },
      },
    ];
  });

  apply('inspection', (operation) => {
    operation.department = '质检';
    operation.selectedOptionCodes = ['inspection-1', 'inspection-2', 'inspection-3', 'inspection-7'];
  });

  apply('packaging', (operation) => {
    operation.department = '包装';
    operation.details = [
      {
        detailSeq: 1,
        detailType: '',
        params: {
          packagingMethod: '木托+防锈纸',
          protectionRequirement: '端面防磕碰',
          packageQuality: '标签清晰、捆扎牢固',
        },
      },
    ];
  });

  return card;
};
