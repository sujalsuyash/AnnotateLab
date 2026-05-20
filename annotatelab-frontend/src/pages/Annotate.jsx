import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function Annotate({ user }) {
  const [images, setImages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [label, setLabel] = useState('')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const current = images[currentIndex] || null

  useEffect(() => {
    fetchAll()
  }, [])

  // Reset label and caption when image changes
  useEffect(() => {
    setLabel(current?.label || '')
    setCaption(current?.caption || '')
  }, [currentIndex])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('annotations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      setImages(data || [])
      setCurrentIndex(0)
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!label || !current) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('annotations')
        .update({
          label,
          caption,
          labeled_by: user?.email,
          labeled_at: new Date().toISOString(),
          status: 'complete'
        })
        .eq('id', current.id)

      if (error) throw error
      toast('Saved!', 'success')

      // Remove saved image from list and stay at same index
      const updated = images.filter(img => img.id !== current.id)
      setImages(updated)
      setCurrentIndex(i => Math.min(i, updated.length - 1))
      setLabel('')
      setCaption('')
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!current) return
    try {
      await supabase
        .from('annotations')
        .update({ created_at: new Date().toISOString() })
        .eq('id', current.id)

      // Move skipped image to end of list
      const updated = [...images]
      const [skipped] = updated.splice(currentIndex, 1)
      updated.push(skipped)
      setImages(updated)
      setCurrentIndex(i => Math.min(i, updated.length - 1))
      setLabel('')
      setCaption('')
    } catch (err) {
      toast('Skip failed: ' + err.message, 'error')
    }
  }

  const goNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(i => i + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'TEXTAREA') return
      if (e.key === '1') setLabel('engaged')
      if (e.key === '2') setLabel('disengaged')
      if (e.key === '3') setLabel('neutral')
      if (e.key === 'Enter' && label) handleSave()
      if (e.key === 's' && e.ctrlKey) {
        e.preventDefault()
        handleSkip()
      }
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [label, current, currentIndex, images])

  if (loading) return <div className="page-loading">Loading...</div>

  if (!current) {
    return (
      <div className="page">
        <div className="done-screen">
          <h2 className="done-title">All done!</h2>
          <p className="done-desc">No more pending annotations.</p>
          <div className="done-actions">
            <Link to="/upload" className="btn-primary">Upload More</Link>
            <Link to="/" className="btn-ghost">Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const borderColor =
    label === 'engaged' ? '#22c55e' :
    label === 'disengaged' ? '#f43f5e' :
    label === 'neutral' ? '#f59e0b' : '#1e2d48'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Annotate</h1>
          <p className="page-subtitle">
            <span className="mono">{currentIndex + 1}</span> of <span className="mono">{images.length}</span> pending
          </p>
        </div>
      </div>

      <div className="annotate-layout">
        {/* Image */}
        <div className="annotate-image-wrap" style={{ borderColor }}>
          <img
            src={current.image_url}
            alt={current.file_name}
            className="annotate-image"
          />
        </div>

        {/* Controls */}
        <div className="annotate-controls">

          {/* File info */}
          <div className="annotate-meta">
            <span className="mono">{current.file_name}</span>
            {current.source_type === 'video' && (
              <span className="meta-tag">Frame {current.frame_number}</span>
            )}
          </div>

          {/* Label Buttons */}
          <div className="label-section">
            <p className="label-hint">Select a label <span className="hint-keys">(1 / 2 / 3)</span></p>
            <div className="label-buttons">
              <button
                className={`label-btn engaged ${label === 'engaged' ? 'selected' : ''}`}
                onClick={() => setLabel('engaged')}
              >
                Engaged
              </button>
              <button
                className={`label-btn disengaged ${label === 'disengaged' ? 'selected' : ''}`}
                onClick={() => setLabel('disengaged')}
              >
                Disengaged
              </button>
              <button
                className={`label-btn neutral ${label === 'neutral' ? 'selected' : ''}`}
                onClick={() => setLabel('neutral')}
              >
                Neutral
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="caption-section">
            <label className="caption-label">Caption (optional)</label>
            <textarea
              className="caption-input"
              placeholder="Describe what you see..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
            />
          </div>

          {/* Navigation + Actions */}
          <div className="annotate-actions">
            <button
              className="btn-ghost"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ← Prev
            </button>
            <button
              className="btn-ghost"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip <span className="hint-keys">(Ctrl+S)</span>
            </button>
            <button
              className="btn-ghost"
              onClick={goNext}
              disabled={currentIndex === images.length - 1}
            >
              Next →
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!label || saving}
            >
              {saving ? 'Saving...' : 'Save & Next'}
              {label && <span className="hint-keys"> (Enter)</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}