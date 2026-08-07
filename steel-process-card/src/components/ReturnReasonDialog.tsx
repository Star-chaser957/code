type ReturnReasonDialogProps = {
  open: boolean;
  cardTitle: string;
  reason: string;
  onClose: () => void;
  onEdit?: () => void;
};

export function ReturnReasonDialog({ open, cardTitle, reason, onClose, onEdit }: ReturnReasonDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop no-print" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card return-reason-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="return-reason-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="return-reason-dialog__heading">
          <span className="return-reason-dialog__badge">退回提醒</span>
          <h3 id="return-reason-title">{cardTitle} 已退回到当前环节</h3>
          <p>请先查看退回理由，再修改或重新审阅工艺卡。</p>
        </div>
        <div className="return-reason-dialog__content">
          <span>退回理由</span>
          <strong>{reason || '未填写退回理由。'}</strong>
        </div>
        <div className="toolbar return-reason-dialog__actions">
          <button type="button" className={`button ${onEdit ? 'button--ghost' : 'button--primary'}`} onClick={onClose} autoFocus={!onEdit}>
            我知道了
          </button>
          {onEdit ? (
            <button type="button" className="button button--primary" onClick={onEdit} autoFocus>
              进入编辑修改
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
