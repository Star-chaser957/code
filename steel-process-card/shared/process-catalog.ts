import type {
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

export const PROCESS_CATALOG: OperationDefinition[] = [
  {
    code: 'steelmaking',
    name: '炼钢',
    defaultOrder: 10,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'ingotType', label: '锭型' },
      { key: 'count', label: '支数' },
      { key: 'weight', label: '重量' },
      { key: 'composition', label: '成分' },
    ],
    optionCatalog: createOptions('steelmaking', ['非真空感应炉', '非真空感应炉+AOD', '真空感应炉', '电渣']),
  },
  {
    code: 'blooming',
    name: '开坯',
    defaultOrder: 20,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
      { key: 'length', label: '长度' },
    ],
    optionCatalog: createOptions('blooming', ['热轧', '热锻']),
  },
  {
    code: 'sawing',
    name: '锯床',
    defaultOrder: 30,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [{ key: 'length', label: '长度' }],
    optionCatalog: [],
  },
  {
    code: 'grinding-repair',
    name: '修磨',
    defaultOrder: 40,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [{ key: 'appearance', label: '外观' }],
    optionCatalog: createOptions('grinding-repair', ['点修', '全抛', '其他']),
  },
  {
    code: 'forming',
    name: '成型',
    defaultOrder: 50,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
      { key: 'length', label: '长度' },
    ],
    optionCatalog: createOptions('forming', ['轧制', '锻造']),
  },
  {
    code: 'finishing',
    name: '精整',
    defaultOrder: 60,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
      { key: 'length', label: '长度' },
      { key: 'appearance', label: '外观' },
      { key: 'metallography', label: '金相' },
    ],
    optionCatalog: [],
  },
  {
    code: 'pickling',
    name: '酸洗',
    defaultOrder: 70,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
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
      { key: 'temperature', label: '温度' },
      { key: 'duration', label: '时长' },
      { key: 'cooling', label: '冷却' },
      { key: 'performance', label: '性能' },
    ],
    optionCatalog: createOptions('heat-treatment', ['退火', '固溶', '调质', '时效', '其他']),
  },
  {
    code: 'straightening',
    name: '矫直',
    defaultOrder: 90,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [{ key: 'straightness', label: '直线度' }],
    optionCatalog: [],
  },
  {
    code: 'peeling',
    name: '剥皮',
    defaultOrder: 100,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
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
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
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
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
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
    detailLabel: '质量要求',
    fieldConfig: [{ key: 'length', label: '长度' }],
    optionCatalog: [],
  },
  {
    code: 'polishing',
    name: '抛光',
    defaultOrder: 140,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'diameter', label: '直径' },
      { key: 'roughness', label: '粗糙度' },
    ],
    optionCatalog: [],
  },
  {
    code: 'chamfering',
    name: '倒角',
    defaultOrder: 150,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [{ key: 'cAngle', label: 'C角' }],
    optionCatalog: [],
  },
  {
    code: 'grinding',
    name: '研磨',
    defaultOrder: 160,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
    fieldConfig: [
      { key: 'passes', label: '研磨道次' },
      { key: 'diameter', label: '直径' },
      { key: 'roughness', label: '粗糙度' },
      { key: 'straightness', label: '直线度' },
    ],
    optionCatalog: [],
  },
  {
    code: 'testing',
    name: '探伤',
    defaultOrder: 170,
    detailMode: 'single',
    allowsMultipleDetails: false,
    detailLabel: '质量要求',
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

export const createEmptyDetail = (definition: OperationDefinition, detailSeq = 1): OperationDetail => ({
  detailSeq,
  detailType: definition.detailMode === 'multiple' ? definition.optionCatalog[0]?.label ?? '' : '',
  params: Object.fromEntries(definition.fieldConfig.map((field) => [field.key, ''])),
});

export const createEmptyOperation = (definition: OperationDefinition): CardOperation => ({
  operationCode: definition.code,
  sortOrder: definition.defaultOrder,
  enabled: false,
  department: '',
  specialCharacteristic: '',
  deliveryTime: '',
  otherRequirements: '',
  remark: '',
  selectedOptionCodes: [],
  details: definition.detailMode === 'checklist' ? [] : [createEmptyDetail(definition)],
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
  operations: definitions.map(createEmptyOperation),
});

export const createDemoProcessCard = (
  definitions: OperationDefinition[] = PROCESS_CATALOG,
): ProcessCardPayload => {
  const card = createEmptyProcessCard(definitions);
  card.cardNo = '';
  card.planNumber = 'JH-20260330-01';
  card.customerCode = 'KH-018';
  card.orderDate = '2026-03-30';
  card.productName = '耐蚀圆钢';
  card.material = 'SUS316L';
  card.specification = 'Φ48 x 6000mm';
  card.quantity = '12支 / 2.8吨';
  card.deliveryDate = '2026-04-12';
  card.deliveryStatus = '成品待发';
  card.standard = 'ASTM A276';
  card.technicalRequirements = '表面无裂纹、折叠与明显划伤；热处理后满足固溶性能要求。';
  card.preparedBy = '张工';
  card.preparedDate = '2026-03-30';
  card.confirmedBy = '李工';
  card.confirmedDate = '2026-03-30';

  const apply = (code: string, updater: (operation: CardOperation) => void) => {
    const target = card.operations.find((item) => item.operationCode === code);
    if (!target) {
      return;
    }
    target.enabled = true;
    updater(target);
  };

  apply('steelmaking', (operation) => {
    operation.department = '炼钢车间';
    operation.selectedOptionCodes = ['steelmaking-2'];
    operation.details[0].params = {
      ingotType: '圆锭',
      count: '12',
      weight: '2.9吨',
      composition: '按 316L 成分控制',
    };
  });

  apply('blooming', (operation) => {
    operation.department = '轧钢车间';
    operation.selectedOptionCodes = ['blooming-1'];
    operation.details[0].params = {
      diameter: 'Φ60',
      length: '6200mm',
    };
  });

  apply('heat-treatment', (operation) => {
    operation.department = '热处理';
    operation.specialCharacteristic = 'S';
    operation.details = [
      {
        detailSeq: 1,
        detailType: '退火',
        params: {
          temperature: '720℃',
          duration: '2h',
          cooling: '炉冷',
          performance: '组织均匀',
        },
      },
      {
        detailSeq: 2,
        detailType: '固溶',
        params: {
          temperature: '1050℃',
          duration: '1.5h',
          cooling: '水冷',
          performance: '满足耐蚀性能',
        },
      },
    ];
  });

  apply('straightening', (operation) => {
    operation.department = '精整';
    operation.details[0].params = {
      straightness: '≤1.5mm/m',
    };
  });

  apply('inspection', (operation) => {
    operation.department = '质检';
    operation.selectedOptionCodes = ['inspection-1', 'inspection-2', 'inspection-3', 'inspection-6', 'inspection-8'];
  });

  apply('packaging', (operation) => {
    operation.department = '包装';
    operation.details[0].params = {
      packagingMethod: '木托+防锈纸',
      protectionRequirement: '端面防磕碰',
      packageQuality: '标签清晰、捆扎牢固',
    };
  });

  return card;
};
