import React from "react";
import shellStyles from "./forge-console-shell.module.css";
import styles from "./forge-confirm-dialog.module.css";

type ForgeConfirmDialogProps = {
  open: boolean;
  label: string;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmButtonClassName?: string;
  closeLabel?: string;
  dialogClassName?: string;
};

export default function ForgeConfirmDialog({
  open,
  label,
  title,
  description,
  onCancel,
  onConfirm,
  cancelLabel = "取消",
  confirmLabel = "确认",
  confirmButtonClassName,
  closeLabel = "关闭确认弹窗",
  dialogClassName = ""
}: ForgeConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div
        aria-label={label}
        aria-modal="true"
        className={`${shellStyles.card} ${styles.dialog} ${dialogClassName}`.trim()}
        role="dialog"
      >
        <div className={styles.header}>
          <div>
            <h2>{title}</h2>
          </div>
          <button aria-label={closeLabel} className={styles.closeButton} onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <button className={shellStyles.secondaryButton} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={confirmButtonClassName ?? shellStyles.primaryButton}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
