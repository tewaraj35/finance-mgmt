import { useState, useEffect, useRef } from 'react'

const PRESET_ICONS = ['💰','🏦','🛟','🎯','🏠','🚗','✈️','🎓','💊','🛒','🍔','🎮','💻','👶','💳','🌴']

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export default function PocketFormModal({ mode, initial, onSave, onClose }) {
  const isEdit = mode === 'edit'

  const [name,          setName]          = useState(initial?.name          ?? '')
  const [icon,          setIcon]          = useState(initial?.icon          ?? '💰')
  const [color,         setColor]         = useState(initial?.color         ?? '#3b82f6')
  const [creditAmount,  setCreditAmount]  = useState(initial?.credit_amount ?? '')
  const [description,   setDescription]  = useState(initial?.description   ?? '')
  const [saving,        setSaving]        = useState(false)

  const nameRef = useRef(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const valid = name.trim() && parseFloat(creditAmount) >= 0

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSave({
        name:          name.trim(),
        icon,
        color,
        credit_amount: parseFloat(creditAmount) || 0,
        description:   description.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-pocket-form">
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Edit Pocket' : '👝 New Pocket'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          {/* Icon picker */}
          <label className="form-label">Icon</label>
          <div className="icon-picker">
            {PRESET_ICONS.map(ic => (
              <button
                key={ic}
                type="button"
                className={`icon-option ${icon === ic ? 'icon-selected' : ''}`}
                style={icon === ic ? { borderColor: color } : {}}
                onClick={() => setIcon(ic)}
              >
                {ic}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <label className="form-label">Color</label>
          <div className="color-picker">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? 'color-selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="pocket-preview" style={{ borderColor: color }}>
            <span style={{ fontSize: '1.4rem' }}>{icon}</span>
            <span style={{ fontWeight: 700, color }}>{name || 'Pocket name'}</span>
          </div>

          {/* Name */}
          <label className="form-label">Name</label>
          <input
            ref={nameRef}
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Emergency Fund, Vacation, Sinking Fund"
            required
          />

          {/* Credit amount */}
          <label className="form-label">Credit Amount (RM)</label>
          <input
            className="form-input"
            type="number"
            value={creditAmount}
            onChange={e => setCreditAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />

          {/* Description */}
          <label className="form-label">Description <span className="opt">(optional)</span></label>
          <input
            className="form-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. For unexpected car or home expenses"
          />

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!valid || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Pocket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
