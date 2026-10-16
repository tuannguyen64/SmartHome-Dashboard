import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';

export function Toggle({ on, onChange, disabled, pending, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={`toggle${on ? ' on' : ''}${pending ? ' pending' : ''}`}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
    />
  );
}

export function Badge({ tone = 'gray', children, dot }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className={`dot dot-${tone === 'gray' ? 'gray' : tone}`} style={{ width: 7, height: 7 }} />}
      {children}
    </span>
  );
}

export function Field({ label, error, children, hint, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="small muted">{hint}</span> : null}
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      {title && <strong>{title}</strong>}
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 20, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function Spinner() {
  return <span className="spinner" aria-label="Đang tải" />;
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="pager">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
      </span>
      <div className="inline">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="mono">
          Trang {page}/{pages}
        </span>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="x" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Hộp xác nhận dùng chung: const [confirm, dialog] = useConfirm()
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (opts) =>
    new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = state ? (
    <Modal
      title={state.title ?? 'Xác nhận'}
      onClose={() => close(false)}
      width={460}
      footer={
        <>
          <button className="btn btn-soft" onClick={() => close(false)}>
            Hủy
          </button>
          <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
            {state.confirmText ?? 'Đồng ý'}
          </button>
        </>
      }
    >
      <div className="stack-sm" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
        {state.message}
      </div>
    </Modal>
  ) : null;
  return [confirm, dialog];
}

export function ColorSwatches({ value, onChange, colors, disabled }) {
  return (
    <div className="inline" style={{ gap: 8 }}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          aria-label={`Màu ${c}`}
          onClick={() => onChange(c)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: c,
            border: c.toLowerCase() === '#ffffff' ? '1.5px solid var(--border-2)' : '1.5px solid transparent',
            outline: value?.toLowerCase() === c.toLowerCase() ? '2.5px solid var(--primary)' : 'none',
            outlineOffset: 2,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ))}
      <label
        title="Chọn màu khác"
        style={{ position: 'relative', width: 28, height: 28, borderRadius: 8, overflow: 'hidden', border: '1.5px dashed var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', opacity: disabled ? 0.5 : 1 }}
      >
        <Icon name="plus" size={14} />
        <input
          type="color"
          disabled={disabled}
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </label>
    </div>
  );
}

// Thanh trượt hai đầu (ngưỡng dưới / trên) theo Figma màn Tự động hóa
export function RangeSlider({ min, max, step = 1, low, high, onChange, disabled }) {
  const pct = (v) => ((v - min) / (max - min)) * 100;
  const lo = low ?? min;
  const hi = high ?? max;
  return (
    <div className={`range2${disabled ? ' disabled' : ''}`}>
      <div className="range2-track" />
      <div
        className="range2-fill"
        style={{
          left: `${low == null ? 0 : pct(lo)}%`,
          right: `${high == null ? 0 : 100 - pct(hi)}%`,
          opacity: low == null && high == null ? 0 : 1,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        disabled={disabled || low == null}
        aria-label="Ngưỡng dưới"
        onChange={(e) => onChange(Math.min(Number(e.target.value), hi - step), high)}
        style={{ visibility: low == null ? 'hidden' : 'visible' }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        disabled={disabled || high == null}
        aria-label="Ngưỡng trên"
        onChange={(e) => onChange(low, Math.max(Number(e.target.value), lo + step))}
        style={{ visibility: high == null ? 'hidden' : 'visible' }}
      />
    </div>
  );
}
