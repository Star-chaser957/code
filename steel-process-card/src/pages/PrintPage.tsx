import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OperationDefinition, ProcessCardPayload } from '../../shared/types';
import { PrintTemplate } from '../components/PrintTemplate';
import { api } from '../lib/api';

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
          <p>当前模板按 A4 竖版优化，建议使用浏览器“另存为 PDF”。</p>
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

      <PrintTemplate card={card} definitions={definitions} />
    </div>
  );
}
