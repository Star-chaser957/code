import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListItem,
} from '../../shared/types';
import { CARD_STATUS_LABELS } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { exportProcessCardsZip } from '../lib/batch-export';

export function ListPage() {
  const navigate = useNavigate();
  const { hasWorkflowRole } = useAuth();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [cards, setCards] = useState<ProcessCardListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [batchHint, setBatchHint] = useState('');
  const [filters, setFilters] = useState<ProcessCardListFilters>({
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
  });

  const deferredKeyword = useDeferredValue(filters.keyword ?? '');
  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.code, item.name])),
    [definitions],
  );
  const allVisibleIds = useMemo(() => cards.map((item) => item.id), [cards]);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));

  const loadCards = async (nextFilters: ProcessCardListFilters) => {
    setLoading(true);

    try {
      const response = await api.listProcessCards(nextFilters);
      setCards(response.items);
      setSelectedIds((current) => current.filter((id) => response.items.some((item) => item.id === id)));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void api.getOperationDefinitions().then((response) => setDefinitions(response.items));
  }, []);

  useEffect(() => {
    void loadCards({ ...filters, keyword: deferredKeyword });
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
  ]);

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
            {allVisibleSelected ? '取消全选' : '全选当前列表'}
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
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>计划单号</span>
            <input
              value={filters.planNumber}
              onChange={(event) => setFilters((current) => ({ ...current, planNumber: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>客户代码</span>
            <input
              value={filters.customerCode}
              onChange={(event) => setFilters((current) => ({ ...current, customerCode: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>产品名称</span>
            <input
              value={filters.productName}
              onChange={(event) => setFilters((current) => ({ ...current, productName: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>材质</span>
            <input
              value={filters.material}
              onChange={(event) => setFilters((current) => ({ ...current, material: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>规格</span>
            <input
              value={filters.specification}
              onChange={(event) => setFilters((current) => ({ ...current, specification: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>交付日期</span>
            <input
              type="date"
              value={filters.deliveryDate}
              onChange={(event) => setFilters((current) => ({ ...current, deliveryDate: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>流程状态</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ProcessCardListFilters['status'] }))}
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
              onChange={(event) => setFilters((current) => ({ ...current, operationCode: event.target.value }))}
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
              onChange={(event) => setFilters((current) => ({ ...current, heatTreatmentType: event.target.value }))}
            >
              <option value="">全部</option>
              {heatTreatmentOptions.map((item) => (
                <option key={item.optionCode} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>列表结果</h3>
          <span>{loading ? '加载中...' : `共 ${cards.length} 条，已选择 ${selectedIds.length} 条`}</span>
        </div>

        {error ? <div className="state state--error">{error}</div> : null}
        {batchHint ? <div className="state">{batchHint}</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={cards.length === 0}
                    aria-label="全选当前列表"
                  />
                </th>
                <th>计划单号</th>
                <th>产品信息</th>
                <th>状态</th>
                <th>当前处理人</th>
                <th>工序</th>
                <th>热处理</th>
                <th>更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </td>
                  <td>
                    {item.planNumber}
                    <br />
                    V{item.versionNo}
                  </td>
                  <td>
                    <strong>{item.productName}</strong>
                    <br />
                    {item.material} / {item.specification}
                    <br />
                    {item.customerCode}
                  </td>
                  <td>
                    {CARD_STATUS_LABELS[item.status]}
                    {item.lastReturnComment ? <div className="table-note">{item.lastReturnComment}</div> : null}
                  </td>
                  <td>{item.currentHandlerName || '-'}</td>
                  <td>{item.enabledOperationCodes.map((code) => definitionMap.get(code) ?? code).join('、')}</td>
                  <td>{item.heatTreatmentTypes.join('、') || '-'}</td>
                  <td>{new Date(item.updatedAt).toLocaleString('zh-CN')}</td>
                  <td className="table-actions">
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
                          onClick={() => navigate(`/cards/${item.id}/print`)}
                        >
                          查看
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => navigate(`/cards/${item.id}/print`)}
                      >
                        审阅
                      </button>
                    )}
                    {item.permissions.canDelete ? (
                      <button type="button" className="link-button danger" onClick={() => void handleDelete(item.id)}>
                        删除
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
