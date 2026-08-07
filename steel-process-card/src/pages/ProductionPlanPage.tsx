import { useEffect, useMemo, useState } from 'react';
import type { ProductionPlanAttachment } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { ProductionPlanAttachmentPanel, ProductionPlanPreviewDialog } from '../components/ProductionPlanAttachmentPanel';
import { ProductionPlanCardsDialog } from '../components/ProductionPlanCardsDialog';
import { useToast } from '../components/ToastProvider';
import { api } from '../lib/api';

const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

function validateFile(file: File) {
  if (!allowedTypes.includes(file.type)) {
    return '仅支持 PNG、JPG、WEBP 图片或 PDF 文件。';
  }
  if (file.size > 15 * 1024 * 1024) {
    return '生产计划单不能超过 15MB。';
  }
  return '';
}

export function ProductionPlanPage() {
  const { user, isAdmin, hasWorkflowRole } = useAuth();
  const { pushToast } = useToast();
  const canManage = isAdmin || hasWorkflowRole('prepare');
  const [items, setItems] = useState<ProductionPlanAttachment[]>([]);
  const [planNumber, setPlanNumber] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState('');
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewItem, setPreviewItem] = useState<ProductionPlanAttachment | null>(null);
  const [relationItem, setRelationItem] = useState<ProductionPlanAttachment | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await api.listProductionPlans();
      setItems(response.items);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生产计划单附件加载失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingFile]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    void Promise.all(
      items.map(async (item) => {
        try {
          const url = URL.createObjectURL(await api.getProductionPlanContent(item.id));
          objectUrls.push(url);
          return [item.id, url] as const;
        } catch {
          return [item.id, ''] as const;
        }
      }),
    ).then((entries) => {
      if (active) {
        setPreviewUrls(Object.fromEntries(entries));
      }
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => item.planNumber.toLowerCase().includes(normalized));
  }, [items, keyword]);

  const selectPendingFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPendingFile(file);
    setError('');
  };

  const handleUpload = async () => {
    if (!planNumber.trim() || !pendingFile) {
      setError('请填写计划单号并选择附件。');
      return;
    }
    setSaving(true);
    try {
      await api.uploadProductionPlan(planNumber.trim(), pendingFile);
      setPlanNumber('');
      setPendingFile(null);
      await loadItems();
      pushToast({ tone: 'success', title: '计划单已上传', description: '现在可以在新建工艺卡中按计划单号匹配。' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生产计划单上传失败。');
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async (item: ProductionPlanAttachment, file?: File) => {
    if (!file) {
      return;
    }
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await api.uploadProductionPlan(item.planNumber, file, item.id);
      await loadItems();
      pushToast({ tone: 'success', title: '附件已替换', description: item.planNumber });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '附件替换失败。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ProductionPlanAttachment) => {
    if (!window.confirm(`确定删除生产计划单“${item.planNumber}”吗？`)) {
      return;
    }
    setSaving(true);
    try {
      await api.deleteProductionPlan(item.id);
      await loadItems();
      pushToast({ tone: 'success', title: '计划单已删除', description: item.planNumber });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生产计划单删除失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page production-plan-page">
      <ProductionPlanPreviewDialog
        open={Boolean(previewItem)}
        previewUrl={previewItem?.id === 'pending' ? pendingPreviewUrl : previewItem ? previewUrls[previewItem.id] || '' : ''}
        mimeType={previewItem?.mimeType || ''}
        fileName={previewItem?.planNumber || '生产计划单'}
        onClose={() => setPreviewItem(null)}
      />
      <ProductionPlanCardsDialog plan={relationItem} onClose={() => setRelationItem(null)} />
      <header className="page__header">
        <div><p className="page__eyebrow">Production Plans</p><h2>计划单列表</h2><p>按计划单号集中管理原图或 PDF，同一份计划单可以关联多张工艺卡。</p></div>
      </header>

      {error ? <div className="state state--error">{error}</div> : null}

      {canManage ? (
        <section className="panel production-plan-upload-panel">
          <div className="panel__header"><div><h3>上传计划单</h3><span>只登记计划单号和原始附件，不读取或解析文件内容。</span></div></div>
          <div className="production-plan-upload-grid">
            <label className="field"><span>计划单号</span><input value={planNumber} onChange={(event) => setPlanNumber(event.target.value)} placeholder="例如 XM26080036" /></label>
            <ProductionPlanAttachmentPanel
              attachment={null}
              pendingFile={pendingFile}
              previewUrl={pendingPreviewUrl}
              editable
              onSelect={selectPendingFile}
              onDelete={() => setPendingFile(null)}
              onOpen={() => pendingFile && setPreviewItem({ id: 'pending', planNumber, fileName: pendingFile.name, mimeType: pendingFile.type, size: pendingFile.size, uploadedByName: user?.displayName || '', createdAt: new Date().toISOString(), linkedCardCount: 0 })}
            />
            <div className="toolbar production-plan-upload-actions"><button type="button" className="button button--primary" disabled={saving} onClick={() => void handleUpload()}>{saving ? '正在上传...' : '上传并保存'}</button></div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header"><div><h3>计划单列表</h3><span>共 {items.length} 份</span></div><input className="production-plan-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索计划单号" /></div>
        {loading ? <div className="state">正在读取附件...</div> : (
          <div className="production-plan-library">
            {filteredItems.map((item) => (
              <article className="production-plan-library__item" key={item.id}>
                <div className="production-plan-library__heading"><div><strong>{item.planNumber}</strong><button type="button" className={`production-plan-link-count ${item.linkedCardCount > 0 ? 'has-links' : ''}`} onClick={() => setRelationItem(item)}>已关联 <b>{item.linkedCardCount}</b> 张工艺卡<small>点击查看</small></button></div><small>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</small></div>
                <ProductionPlanAttachmentPanel attachment={item} previewUrl={previewUrls[item.id] || ''} compact onOpen={() => setPreviewItem(item)} />
                {canManage ? <div className="toolbar production-plan-library__actions"><label className="button button--ghost button--small">替换附件<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden disabled={saving} onChange={(event) => void handleReplace(item, event.target.files?.[0])} /></label><button type="button" className="button button--danger-ghost button--small" disabled={saving || item.linkedCardCount > 0} title={item.linkedCardCount > 0 ? '已关联工艺卡，不能删除' : ''} onClick={() => void handleDelete(item)}>删除</button></div> : null}
              </article>
            ))}
            {filteredItems.length === 0 ? <div className="state">当前没有符合条件的生产计划单附件。</div> : null}
          </div>
        )}
      </section>
    </div>
  );
}
