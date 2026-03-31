import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OperationDefinition, ProcessCardListFilters, ProcessCardListItem } from '../../shared/types';
import { api } from '../lib/api';

export function ListPage() {
  const navigate = useNavigate();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [cards, setCards] = useState<ProcessCardListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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
  });

  const deferredKeyword = useDeferredValue(filters.keyword ?? '');
  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.code, item.name])),
    [definitions],
  );

  useEffect(() => {
    void api.getOperationDefinitions().then((response) => setDefinitions(response.items));
  }, []);

  useEffect(() => {
    const nextFilters = { ...filters, keyword: deferredKeyword };
    setLoading(true);
    void api
      .listProcessCards(nextFilters)
      .then((response) => {
        setCards(response.items);
        setSelectedIds((current) => current.filter((id) => response.items.some((item) => item.id === id)));
        setError('');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '列表加载失败'))
      .finally(() => setLoading(false));
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
  ]);

  const heatTreatmentOptions = useMemo(
    () => definitions.find((item) => item.code === 'heat-treatment')?.optionCatalog ?? [],
    [definitions],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除这张工艺卡吗？')) {
      return;
    }

    await api.deleteProcessCard(id);
    const response = await api.listProcessCards({ ...filters, keyword: deferredKeyword });
    setCards(response.items);
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) {
      setBatchHint('请先勾选需要批量导出的工艺卡。');
      return;
    }

    const response = await api.batchExport({ ids: selectedIds });
    response.items.forEach((item) => {
      window.open(item.printUrl, '_blank', 'noopener,noreferrer');
    });
    setBatchHint('已打开打印预览页，请在浏览器中使用“另存为 PDF”完成批量导出。');
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Process Card Library</p>
          <h2>工艺卡列表</h2>
          <p>支持按计划单号、材质、工序和热处理类型快速筛选。</p>
        </div>
        <div className="toolbar">
          <Link to="/cards/new" className="button button--primary">
            新建工艺卡
          </Link>
          <button type="button" className="button" onClick={() => void handleBatchExport()}>
            批量导出
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
              onChange={(event) =>
                setFilters((current) => ({ ...current, heatTreatmentType: event.target.value }))
              }
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
          <span>{loading ? '加载中...' : `共 ${cards.length} 条`}</span>
        </div>

        {error ? <div className="state state--error">{error}</div> : null}
        {batchHint ? <div className="state">{batchHint}</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>计划单号</th>
                <th>客户代码</th>
                <th>产品名称</th>
                <th>材质 / 规格</th>
                <th>交付日期</th>
                <th>工序</th>
                <th>热处理</th>
                <th>更新时间</th>
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
                  <td>{item.planNumber}</td>
                  <td>{item.customerCode}</td>
                  <td>{item.productName}</td>
                  <td>
                    {item.material}
                    <br />
                    {item.specification}
                  </td>
                  <td>{item.deliveryDate}</td>
                  <td>
                    {item.enabledOperationCodes
                      .map((code) => definitionMap.get(code) ?? code)
                      .join('、')}
                  </td>
                  <td>{item.heatTreatmentTypes.join('、')}</td>
                  <td>{new Date(item.updatedAt).toLocaleString('zh-CN')}</td>
                  <td className="table-actions">
                    <button type="button" className="link-button" onClick={() => navigate(`/cards/${item.id}/edit`)}>
                      编辑
                    </button>
                    <button type="button" className="link-button" onClick={() => navigate(`/cards/${item.id}/print`)}>
                      打印
                    </button>
                    <button type="button" className="link-button danger" onClick={() => void handleDelete(item.id)}>
                      删除
                    </button>
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
