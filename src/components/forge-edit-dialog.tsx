"use client";

import React from "react";
import shellStyles from "./forge-console-shell.module.css";
import styles from "./forge-edit-dialog.module.css";

type ForgeEditDialogProps = {
  ariaLabel: string;
  bodyClassName?: string;
  children: React.ReactNode;
  closeLabel?: string;
  dialogClassName?: string;
  draggable?: boolean;
  eyebrow?: string;
  footer?: React.ReactNode;
  headerClassName?: string;
  onClose: () => void;
  onHeaderMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  overlayClassName?: string;
  style?: React.CSSProperties;
  title: string;
  variant?: "anchored" | "centered";
};

const cx = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(" ");

export default function ForgeEditDialog({
  ariaLabel,
  bodyClassName,
  children,
  closeLabel,
  dialogClassName,
  draggable = false,
  eyebrow,
  footer,
  headerClassName,
  onClose,
  onHeaderMouseDown,
  overlayClassName,
  style,
  title,
  variant = "centered"
}: ForgeEditDialogProps) {
  const dialogStyle = {
    maxHeight: "calc(var(--app-viewport-height) - 48px - var(--app-safe-bottom))",
    ...style
  } satisfies React.CSSProperties;

  return (
    <div
      className={cx(
        variant === "anchored" ? styles.anchoredOverlay : styles.centeredOverlay,
        overlayClassName
      )}
    >
      <div
        aria-label={ariaLabel}
        className={cx(shellStyles.card, styles.dialog, dialogClassName)}
        role="dialog"
        style={dialogStyle}
      >
        <div
          className={cx(styles.header, draggable && styles.draggableHeader, headerClassName)}
          onMouseDown={onHeaderMouseDown}
        >
          <div className={styles.headerContent}>
            {eyebrow ? <p className={shellStyles.eyebrow}>{eyebrow}</p> : null}
            <h3>{title}</h3>
          </div>
          <button
            aria-label={closeLabel ?? `关闭${title}`}
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div
          className={cx(styles.body, bodyClassName)}
          data-testid="forge-edit-dialog-body"
          style={{ minHeight: 0, overflowY: "auto" }}
        >
          {children}
        </div>

        {footer ? <div className={styles.actions}>{footer}</div> : null}
      </div>
    </div>
  );
}
