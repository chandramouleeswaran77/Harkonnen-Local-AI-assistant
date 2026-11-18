import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import './Common.css';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'default', // 'default' | 'wide' | 'narrow'
  noBodyPad = false,
  footer = null,
  headerRight = null,
  children,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            className={`modal-panel ${size !== 'default' ? size : ''}`}
            initial={{ opacity: 0, scale: 0.965, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title">{title}</h2>
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {headerRight}
                <button className="btn-icon" onClick={onClose} aria-label="Close modal">
                  <X size={17} />
                </button>
              </div>
            </div>
            <div className={`modal-body ${noBodyPad ? 'no-pad' : ''}`}>{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
