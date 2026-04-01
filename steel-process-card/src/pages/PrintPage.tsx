import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OperationDefinition, ProcessCardPayload } from '../../shared/types';
import { PrintTemplate } from '../components/PrintTemplate';
import { api } from '../lib/api';

const PRINT_GUIDE_ITEMS = [
  '推荐浏览器：Microsoft Edge 或 Chrome，尽量统一在同一版本段使用。',
  '打印纸张：A4，方向：纵向，缩放：100%。',
  '边距建议：无，由系统模板自行控制版心和留白。',
  '页眉和页脚：关闭，背景图形：开启。',
  '实际打印机建议使用“无边距”或“最小边距”模式，避免内容缩放。',
];

export function PrintPage() {
  const { id } = useParams();
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [card, setCard] = useState<ProcessCardPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const load = async () => {
      try {
        const [definitionResponse, detail] = await Promise.all([
          api.getOperationDefinitions(),
          api.getProcessCard(id),
        ]);
        setDefinitions(definitionResponse.items);
        setCard(detail);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '打印页加载失败');
      }
    };

    void load();
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="state state--error">{error}</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="page">
        <div className="state">正在生成打印预览...</div>
      </div>
    );
  }

  return (
    <div className="print-shell">
      <div className="print-toolbar no-print">
        <div>
          <p className="page__eyebrow">Print Preview</p>
          <h2>打印 / PDF 导出</h2>
          <p>当前模板已按 A4 纵向单页优先优化，下面附带统一打印参数建议。</p>
        </div>
        <div className="toolbar">
          <Link to={`/cards/${card.id}/edit`} className="button">
            返回编辑
          </Link>
          <button type="button" className="button button--primary" onClick={() => window.print()}>
            浏览器打印 / 导出 PDF
          </button>
        </div>
      </div>

      <section className="print-guide no-print">
        <div className="print-guide__header">
          <h3>推荐打印设置</h3>
          <span>建议在局域网所有电脑上统一使用这一套参数</span>
        </div>
        <div className="print-guide__grid">
          {PRINT_GUIDE_ITEMS.map((item) => (
            <div key={item} className="print-guide__item">
              {item}
            </div>
          ))}
        </div>
      </section>

      <PrintTemplate card={card} definitions={definitions} />
    </div>
  );
}
