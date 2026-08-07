import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  OperationDefinition,
  ProcessCardPayload,
  ProductionPlanAttachment,
  ProductionPlanCardRelations,
} from '../../shared/types';
import { CARD_STATUS_LABELS } from '../../shared/types';
import { api } from '../lib/api';
import { PrintTemplate } from './PrintTemplate';

type ProductionPlanCardsDialogProps = {
  plan: ProductionPlanAttachment | null;
  onClose: () => void;
};

export function ProductionPlanCardsDialog({ plan, onClose }: ProductionPlanCardsDialogProps) {
  const [relations, setRelations] = useState<ProductionPlanCardRelations>({ linked: [] });
  const [definitions, setDefinitions] = useState<OperationDefinition[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCard, setSelectedCard] = useState<ProcessCardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!plan) {
      return;
    }
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true);
        }
        return Promise.all([api.getProductionPlanCards(plan.id), api.getOperationDefinitions()]);
      })
      .then(([relationResponse, definitionResponse]) => {
        if (!active) {
          return;
        }
        setRelations(relationResponse);
        setDefinitions(definitionResponse.items);
        setSelectedCardId(relationResponse.linked[0]?.id || '');
        if (relationResponse.linked.length === 0) {
          setSelectedCard(null);
        }
        setError('');
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : '关联工艺卡加载失败。');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [plan]);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }
    let active = true;
    void api.getProcessCard(selectedCardId)
      .then((card) => {
        if (active) {
          setSelectedCard(card);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : '工艺卡预览加载失败。');
        }
      });
    return () => {
      active = false;
    };
  }, [selectedCardId]);

  if (!plan) {
    return null;
  }

  return (
    <div className="modal-backdrop production-plan-card-modal no-print" role="presentation" onMouseDown={onClose}>
      <section className="production-plan-card-modal__card" role="dialog" aria-modal="true" aria-label={`${plan.planNumber}关联工艺卡`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>计划单 {plan.planNumber}</span><h3>关联工艺卡</h3></div>
          <button type="button" className="button button--primary button--small" onClick={onClose}>关闭</button>
        </header>

        {error ? <div className="state state--error production-plan-card-modal__error">{error}</div> : null}
        {loading ? <div className="state">正在读取关联工艺卡...</div> : (
          <div className="production-plan-card-modal__layout">
            <aside className="production-plan-card-selector">
              <div className="production-plan-card-selector__summary">
                <span>已关联业务工艺卡</span>
                <strong>{relations.linked.length} 张</strong>
                <small>同一工艺卡的多个版本仅计算一次，默认展示最新版本</small>
              </div>
              <div className="production-plan-card-buttons">
                {relations.linked.map((card, index) => (
                  <button type="button" className={selectedCardId === card.id ? 'is-active' : ''} key={card.businessCardId} onClick={() => setSelectedCardId(card.id)}>
                    <span>{index + 1}</span>
                    <div><strong>{card.productName || '未填写产品名称'}</strong><small>{[card.material, card.specification].filter(Boolean).join(' · ') || '基础信息未填写'}</small></div>
                    <em>V{card.versionNo}</em>
                  </button>
                ))}
                {relations.linked.length === 0 ? <div className="state">暂未关联工艺卡。</div> : null}
              </div>
            </aside>

            <div className="production-plan-card-preview">
              {selectedCard ? (
                <>
                  <div className="production-plan-card-preview__toolbar">
                    <div><strong>{selectedCard.productName}</strong><span>{CARD_STATUS_LABELS[selectedCard.status]} · V{selectedCard.versionNo}</span></div>
                    <Link className="button button--ghost button--small" to={`/cards/${selectedCard.id}/print`}>打开完整审阅页</Link>
                  </div>
                  <div className="production-plan-card-preview__viewport">
                    <div className="production-plan-card-preview__canvas"><PrintTemplate card={selectedCard} definitions={definitions} /></div>
                  </div>
                </>
              ) : <div className="state">从左侧选择一张工艺卡查看缩略图。</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
