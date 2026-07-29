import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type {
  CardWorkflowStatus,
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListItem,
} from '../../shared/types';
import { CARD_STATUS_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { exportProcessCardsZip } from '../lib/batch-export';

const DEFAULT_LIST_FILTERS: ProcessCardListFilters = {
  keyword: '',
  planNumber: '',
  customerCode: '',
  productName: '',
  material: '',
  specification: '',
  deliveryDate: '',
  operationCode: '',
  heatTreatmentType: '',
  status: '',
  sortBy: 'createdAt',
  sortDirection: 'desc',
  page: 1,
  pageSize: 20,
};

const SORT_FIELDS = new Set<NonNullable<ProcessCardListFilters['sortBy']>>([
  'planNumber',
  'productName',
  'deliveryDate',
  'status',
  'createdAt',
  'updatedAt',
]);

function readPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readListFilters(searchParams: URLSearchParams): ProcessCardListFilters {
  const sortBy = searchParams.get('sortBy') as NonNullable<ProcessCardListFilters['sortBy']> | null;
  const status = searchParams.get('status') ?? '';
  const sortDirection = searchParams.get('sortDirection');

  return {
    ...DEFAULT_LIST_FILTERS,
    keyword: searchParams.get('keyword') ?? '',
    planNumber: searchParams.get('planNumber') ?? '',
    customerCode: searchParams.get('customerCode') ?? '',
    productName: searchParams.get('productName') ?? '',
    material: searchParams.get('material') ?? '',
    specification: searchParams.get('specification') ?? '',
    deliveryDate: searchParams.get('deliveryDate') ?? '',
    operationCode: searchParams.get('operationCode') ?? '',
    heatTreatmentType: searchParams.get('heatTreatmentType') ?? '',
    status: status in CARD_STATUS_LABELS ? (status as CardWorkflowStatus) : '',
    sortBy: sortBy && SORT_FIELDS.has(sortBy) ? sortBy : DEFAULT_LIST_FILTERS.sortBy,
    sortDirection: sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : 'desc',
    page: readPositiveInteger(searchParams.get('page'), 1),
    pageSize: readPositiveInteger(searchParams.get('pageSize'), 20),
  };
}

function writeListFilters(filters: ProcessCardListFilters) {
  const searchParams = new URLSearchParams();
  const textFields = [
    'keyword',
    'planNumber',
    'customerCode',
    'productName',
    'material',
    'specification',
    'deliveryDate',
    'operationCode',
    'heatTreatmentType',
    'status',
  ] as const;

  textFields.forEach((field) => {
    const value = filters[field];
    if (value) {
      searchParams.set(field, value);
    }
  });
  searchParams.set('sortBy', filters.sortBy ?? 'createdAt');
  searchParams.set('sortDirection', filters.sortDirection ?? 'desc');
  searchParams.set('page', String(filters.page ?? 1));
  searchParams.set('pageSize', String(filters.pageSize ?? 20));
  return searchParams;
}

export function ListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasWorkflowRole, isAdmin } = useAuth();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [cards, setCards] = useState<ProcessCardListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [batchHint, setBatchHint] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const requestSequenceRef = useRef(0);
  const [filters, setFilters] = useState<ProcessCardListFilters>(() => readListFilters(searchParams));

  const deferredKeyword = useDeferredValue(filters.keyword ?? '');
  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.code, item.name])),
    [definitions],
  );
  const allVisibleIds = useMemo(() => cards.map((item) => item.id), [cards]);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));

  const loadCards = async (nextFilters: ProcessCardListFilters) => {
    const requestSequence = ++requestSequenceRef.current;
    setLoading(true);

    try {
      const response = await api.listProcessCards(nextFilters);
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }
      setCards(response.items);
      setPagination({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: response.totalPages,
      });
      setError('');
    } catch (reason) {
      if (requestSequence === requestSequenceRef.current) {
        setError(reason instanceof Error ? reason.message : '列表加载失败');
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  };
  const loadCardsEffect = useEffectEvent(loadCards);

  useEffect(() => {
    void api.getOperationDefinitions().then((response) => setDefinitions(response.items));
  }, []);

  useEffect(() => {
    const nextSearchParams = writeListFilters(filters);
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  useEffect(() => {
    void loadCardsEffect({
      keyword: deferredKeyword,
      planNumber: filters.planNumber,
      customerCode: filters.customerCode,
      productName: filters.productName,
      material: filters.material,
      specification: filters.specification,
      deliveryDate: filters.deliveryDate,
      operationCode: filters.operationCode,
      heatTreatmentType: filters.heatTreatmentType,
      status: filters.status,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }, [
    deferredKeyword,
    filters.customerCode,
    filters.deliveryDate,
    filters.heatTreatmentType,
    filters.material,
    filters.operationCode,
    filters.planNumber,
    filters.productName,
    filters.specification,
    filters.status,
    filters.sortBy,
    filters.sortDirection,
    filters.page,
    filters.pageSize,
  ]);

  const updateFilter = (patch: Partial<ProcessCardListFilters>) => {
    setSelectedIds([]);
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  };

  const changeSort = (sortBy: NonNullable<ProcessCardListFilters['sortBy']>) => {
    setFilters((current) => ({
      ...current,
      sortBy,
      sortDirection: current.sortBy === sortBy && current.sortDirection === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const changePage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), pagination.totalPages);
    setSelectedIds([]);
    setFilters((current) => ({ ...current, page: safePage }));
  };

  const openPreview = (id: string) => {
    const currentSearchParams = writeListFilters(filters);
    navigate(`/cards/${id}/print`, {
      state: { listReturnTo: `${location.pathname}?${currentSearchParams.toString()}` },
    });
  };

  const sortMark = (sortBy: NonNullable<ProcessCardListFilters['sortBy']>) =>
    filters.sortBy === sortBy ? (filters.sortDirection === 'asc' ? '↑' : '↓') : '↕';

  const heatTreatmentOptions = useMemo(
    () => definitions.find((item) => item.code === 'heat-treatment')?.optionCatalog ?? [],
    [definitions],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !allVisibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...allVisibleIds]));
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除这张工艺卡吗？')) {
      return;
    }

    await api.deleteProcessCard(id);
    await loadCards({ ...filters, keyword: deferredKeyword });
  };

  const handleVoid = async (id: string) => {
    if (!window.confirm('确认将这张工艺卡作废吗？作废后会保留留痕，但不能再编辑。')) {
      return;
    }

    await api.voidProcessCard(id);
    await loadCards({ ...filters, keyword: deferredKeyword });
  };

  const handleWithdrawReview = async (id: string) => {
    if (!window.confirm('确认撤回已提交的审核吗？撤回后可以继续编辑并重新提交。')) {
      return;
    }
    try {
      await api.performApprovalAction(id, { action: 'withdraw_review', comment: '' });
      navigate(`/cards/${id}/edit`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤回审核失败');
    }
  };

  const handleForceDelete = async (id: string) => {
    if (!window.confirm('确认强制删除这张工艺卡吗？该操作不可恢复。')) {
      return;
    }

    await api.forceDeleteProcessCard(id);
    await loadCards({ ...filters, keyword: deferredKeyword });
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) {
      setBatchHint('请先勾选需要批量导出的工艺卡。');
      return;
    }

    setExporting(true);
    setBatchHint('正在准备批量导出...');

    try {
      const selectedCards = await Promise.all(selectedIds.map((id) => api.getProcessCard(id)));
      await exportProcessCardsZip({
        cards: selectedCards,
        definitions,
        onProgress: (current, total, card) => {
          setBatchHint(`正在生成第 ${current}/${total} 份 PDF：${card.planNumber || card.productName}`);
        },
      });
      setBatchHint(`批量导出完成，已下载包含 ${selectedCards.length} 份 PDF 的 ZIP 压缩包。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '批量导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Process Card Library</p>
          <h2>工艺卡列表</h2>
          <p>支持按状态、关键字段、工序和热处理类型进行查询，并可批量导出。</p>
        </div>
        <div className="toolbar">
          {hasWorkflowRole('prepare') ? (
            <Link to="/cards/new" className="button button--primary">
              新建工艺卡
            </Link>
          ) : null}
          <button type="button" className="button" onClick={toggleSelectAllVisible} disabled={cards.length === 0}>
            {allVisibleSelected ? '取消全选当前页' : '全选当前页'}
          </button>
          <button type="button" className="button" onClick={() => void handleBatchExport()} disabled={exporting}>
            {exporting ? '导出中...' : '批量导出'}
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel__header">
          <h3>筛选条件</h3>
        </div>

        <div className="filter-grid">
          <label className="field">
            <span>关键字</span>
            <input
              value={filters.keyword}
              placeholder="计划单号 / 客户 / 产品 / 材质 / 规格"
              onChange={(event) => updateFilter({ keyword: event.target.value })}
            />
          </label>

          <label className="field">
            <span>计划单号</span>
            <input
              value={filters.planNumber}
              onChange={(event) => updateFilter({ planNumber: event.target.value })}
            />
          </label>

          <label className="field">
            <span>客户代码</span>
            <input
              value={filters.customerCode}
              onChange={(event) => updateFilter({ customerCode: event.target.value })}
            />
          </label>

          <label className="field">
            <span>产品名称</span>
            <input
              value={filters.productName}
              onChange={(event) => updateFilter({ productName: event.target.value })}
            />
          </label>

          <label className="field">
            <span>材质</span>
            <input
              value={filters.material}
              onChange={(event) => updateFilter({ material: event.target.value })}
            />
          </label>

          <label className="field">
            <span>规格</span>
            <input
              value={filters.specification}
              onChange={(event) => updateFilter({ specification: event.target.value })}
            />
          </label>

          <label className="field">
            <span>交付日期</span>
            <input
              type="date"
              value={filters.deliveryDate}
              onChange={(event) => updateFilter({ deliveryDate: event.target.value })}
            />
          </label>

          <label className="field">
            <span>流程状态</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter({ status: event.target.value as ProcessCardListFilters['status'] })}
            >
              <option value="">全部</option>
              {Object.entries(CARD_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>包含工序</span>
            <select
              value={filters.operationCode}
              onChange={(event) => updateFilter({ operationCode: event.target.value })}
            >
              <option value="">全部</option>
              {definitions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>热处理类型</span>
            <select
              value={filters.heatTreatmentType}
              onChange={(event) => updateFilter({ heatTreatmentType: event.target.value })}
            >
              <option value="">全部</option>
              {heatTreatmentOptions.map((item) => (
                <option key={item.optionCode} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>排序方式</span>
            <select
              value={`${filters.sortBy}-${filters.sortDirection}`}
              onChange={(event) => {
                const [sortBy, sortDirection] = event.target.value.split('-') as [
                  NonNullable<ProcessCardListFilters['sortBy']>,
                  NonNullable<ProcessCardListFilters['sortDirection']>,
                ];
                setFilters((current) => ({ ...current, sortBy, sortDirection, page: 1 }));
              }}
            >
              <option value="createdAt-desc">最新创建优先</option>
              <option value="createdAt-asc">最早创建优先</option>
              <option value="updatedAt-desc">最近更新优先</option>
              <option value="updatedAt-asc">最早更新优先</option>
              <option value="planNumber-asc">计划单号升序</option>
              <option value="planNumber-desc">计划单号降序</option>
              <option value="productName-asc">产品名称升序</option>
              <option value="deliveryDate-asc">交付日期最近优先</option>
              <option value="deliveryDate-desc">交付日期最晚优先</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>列表结果</h3>
          <span>{loading ? '加载中...' : `共 ${pagination.total} 条，第 ${pagination.page}/${pagination.totalPages} 页，已选择 ${selectedIds.length} 条`}</span>
        </div>

        {error ? <div className="state state--error">{error}</div> : null}
        {batchHint ? <div className="state">{batchHint}</div> : null}

        <div className="table-wrap">
          <table className="data-table process-card-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={cards.length === 0}
                    aria-label="全选当前页"
                  />
                </th>
                <th><button type="button" className="table-sort" onClick={() => changeSort('planNumber')}>计划单号 <span>{sortMark('planNumber')}</span></button></th>
                <th><button type="button" className="table-sort" onClick={() => changeSort('productName')}>产品信息 <span>{sortMark('productName')}</span></button></th>
                <th><button type="button" className="table-sort" onClick={() => changeSort('status')}>状态 <span>{sortMark('status')}</span></button></th>
                <th>当前处理人</th>
                <th className="table-column--secondary">工序</th>
                <th className="table-column--secondary">热处理</th>
                <th><button type="button" className="table-sort" onClick={() => changeSort('updatedAt')}>更新 <span>{sortMark('updatedAt')}</span></button></th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((item) => (
                <tr key={item.id}>
                  <td data-label="选择">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </td>
                  <td data-label="计划单号">
                    {item.planNumber}
                    {item.versionNo > 1 ? <span className="version-badge">V{item.versionNo}</span> : null}
                  </td>
                  <td data-label="产品信息">
                    <strong>{item.productName}</strong>
                    <br />
                    {item.material} / {item.specification}
                    <br />
                    {item.customerCode}
                  </td>
                  <td data-label="状态">
                    {CARD_STATUS_LABELS[item.status]}
                    {item.lastReturnComment ? <div className="table-note">{item.lastReturnComment}</div> : null}
                  </td>
                  <td data-label="当前处理人">{item.currentHandlerName || '-'}</td>
                  <td data-label="工序" className="table-column--secondary">{item.enabledOperationCodes.map((code) => definitionMap.get(code) ?? code).join('、')}</td>
                  <td data-label="热处理" className="table-column--secondary">{item.heatTreatmentTypes.join('、') || '-'}</td>
                  <td data-label="更新">{new Date(item.updatedAt).toLocaleString('zh-CN')}</td>
                  <td data-label="操作" className="table-actions">
                    {item.permissions.canEdit ? (
                      <>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => navigate(`/cards/${item.id}/edit`)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => openPreview(item.id)}
                        >
                          查看
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => openPreview(item.id)}
                      >
                        审阅
                      </button>
                    )}
                    {item.permissions.canDelete ? (
                      <button type="button" className="link-button danger" onClick={() => void handleDelete(item.id)}>
                        删除
                      </button>
                    ) : null}
                    {item.permissions.canWithdrawReview ? (
                      <button type="button" className="link-button" onClick={() => void handleWithdrawReview(item.id)}>
                        撤回审核
                      </button>
                    ) : null}
                    {isAdmin && item.status !== 'voided' ? (
                      <button type="button" className="link-button" onClick={() => void handleVoid(item.id)}>
                        作废
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => void handleForceDelete(item.id)}
                      >
                        强制删除
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && cards.length === 0 ? <div className="state">没有符合当前条件的工艺卡。</div> : null}

        <div className="pagination">
          <div className="pagination__summary">
            <span>每页</span>
            <select
              value={pagination.pageSize}
              onChange={(event) => {
                setSelectedIds([]);
                setFilters((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }));
              }}
            >
              <option value={20}>20 条</option>
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
            </select>
            <span>共 {pagination.total} 条</span>
          </div>
          <div className="pagination__buttons">
            <button type="button" className="button button--small button--ghost" disabled={loading || pagination.page <= 1} onClick={() => changePage(1)}>首页</button>
            <button type="button" className="button button--small button--ghost" disabled={loading || pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>上一页</button>
            <span className="pagination__current">第 {pagination.page} / {pagination.totalPages} 页</span>
            <button type="button" className="button button--small button--ghost" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>下一页</button>
            <button type="button" className="button button--small button--ghost" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.totalPages)}>末页</button>
          </div>
        </div>
      </section>
    </div>
  );
}
