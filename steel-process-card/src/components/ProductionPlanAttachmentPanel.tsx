import { useRef, useState, type DragEvent } from 'react';
import type { ProductionPlanAttachment } from '../../shared/types';

type ProductionPlanAttachmentPanelProps = {
  attachment: ProductionPlanAttachment | null;
  pendingFile?: File | null;
  previewUrl: string;
  editable?: boolean;
  compact?: boolean;
  loading?: boolean;
  onSelect?: (file: File) => void;
  onDelete?: () => void;
  onOpen: () => void;
};

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,application/pdf';

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ProductionPlanAttachmentPanel({
  attachment,
  pendingFile = null,
  previewUrl,
  editable = false,
  compact = false,
  loading = false,
  onSelect,
  onDelete,
  onOpen,
}: ProductionPlanAttachmentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const fileName = pendingFile?.name || attachment?.fileName || '';
  const mimeType = pendingFile?.type || attachment?.mimeType || '';
  const fileSize = pendingFile?.size ?? attachment?.size ?? 0;
  const hasFile = Boolean(fileName);
  const displayName = attachment?.planNumber || (pendingFile ? '已选择计划单附件' : '生产计划单原件');

  const chooseFile = (file?: File) => {
    if (file && onSelect) {
      onSelect(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  if (loading) {
    return <div className="production-plan-state">正在读取生产计划单...</div>;
  }

  if (!hasFile && !editable) {
    return <div className="production-plan-state">本工艺卡未上传生产计划单。</div>;
  }

  if (!hasFile) {
    return (
      <div
        className={`production-plan-dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="production-plan-dropzone__icon" aria-hidden="true">＋</span>
        <div><strong>上传生产计划单</strong><p>支持 PNG、JPG、WEBP 或 PDF，文件不超过 15MB</p></div>
        <button type="button" className="button button--ghost button--small" onClick={() => inputRef.current?.click()}>
          选择文件
        </button>
        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={(event) => chooseFile(event.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div className={`production-plan-file ${compact ? 'production-plan-file--compact' : ''}`}>
      <button type="button" className="production-plan-file__preview" onClick={onOpen} disabled={!previewUrl}>
        {mimeType.startsWith('image/') && previewUrl ? (
          <img src={previewUrl} alt={fileName} />
        ) : (
          <span className="production-plan-file__pdf">PDF</span>
        )}
        <span className="production-plan-file__preview-action">点击查看</span>
      </button>
      <div className="production-plan-file__meta">
        <strong>{displayName}</strong>
        <span>{formatFileSize(fileSize)}{pendingFile ? ' · 保存时上传' : ''}</span>
        {!compact && attachment?.uploadedByName && !pendingFile ? (
          <small>{attachment.uploadedByName} · {new Date(attachment.createdAt).toLocaleString('zh-CN')}</small>
        ) : null}
      </div>
      {editable ? (
        <div className="production-plan-file__actions">
          <button type="button" className="button button--ghost button--small" onClick={() => inputRef.current?.click()}>替换</button>
          <button type="button" className="button button--danger-ghost button--small" onClick={onDelete}>删除</button>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} hidden onChange={(event) => chooseFile(event.target.files?.[0])} />
        </div>
      ) : null}
    </div>
  );
}

type ProductionPlanPreviewDialogProps = {
  open: boolean;
  previewUrl: string;
  mimeType: string;
  fileName: string;
  onClose: () => void;
};

export function ProductionPlanPreviewDialog({ open, previewUrl, mimeType, fileName, onClose }: ProductionPlanPreviewDialogProps) {
  if (!open || !previewUrl) {
    return null;
  }

  return (
    <div className="modal-backdrop production-plan-modal no-print" role="presentation" onMouseDown={onClose}>
      <section className="production-plan-modal__card" role="dialog" aria-modal="true" aria-label="生产计划单预览" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>生产计划单</span><strong>{fileName}</strong></div>
          <div className="toolbar">
            <a href={previewUrl} target="_blank" rel="noreferrer" className="button button--ghost button--small">新窗口打开</a>
            <button type="button" className="button button--primary button--small" onClick={onClose}>关闭</button>
          </div>
        </header>
        <div className="production-plan-modal__body">
          {mimeType.startsWith('image/') ? <img src={previewUrl} alt={fileName} /> : <iframe src={previewUrl} title={fileName} />}
        </div>
      </section>
    </div>
  );
}
