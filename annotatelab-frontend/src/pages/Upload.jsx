import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function Upload() {
  const [mode, setMode] = useState('images')
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload</h1>
          <p className="page-subtitle">Upload images or extract frames from a video.</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'images' ? 'active' : ''}`}
          onClick={() => setMode('images')}
        >
          Images
        </button>
        <button
          className={`mode-btn ${mode === 'video' ? 'active' : ''}`}
          onClick={() => setMode('video')}
        >
          Video
        </button>
      </div>

      {mode === 'images' ? (
        <ImageUpload toast={toast} navigate={navigate} />
      ) : (
        <VideoUpload toast={toast} navigate={navigate} />
      )}
    </div>
  )
}

/* ─── IMAGE UPLOAD ─── */
function ImageUpload({ toast, navigate }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...dropped])
  }

  const handleBrowse = (e) => {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)

    const BATCH_SIZE = 20
    let allResults = []

    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE)
        setProgress(`Uploading ${Math.min(i + BATCH_SIZE, files.length)} of ${files.length}...`)

        const formData = new FormData()
        batch.forEach(f => formData.append('images', f))

        const res = await fetch('/api/upload/images', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()

        if (data.results?.length > 0) {
          const rows = data.results.map(r => ({
            image_url: r.url,
            file_name: r.fileName,
            source_type: 'image',
            status: 'pending'
          }))

          await supabase.from('annotations').insert(rows)
          allResults = [...allResults, ...data.results]
        }

        if (data.errors?.length > 0) {
          toast(`${data.errors.length} file(s) failed to upload`, 'error')
        }
      }

      toast(`${allResults.length} images uploaded successfully!`, 'success')
      navigate('/annotate')
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  return (
    <div className="card">
      {/* Drop Zone */}
      <div
        className="dropzone"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleBrowse}
        />
        <p className="dropzone-text">Drop images here or click to browse</p>
        <p className="dropzone-hint">Supports JPG, PNG, WEBP</p>
      </div>

      {/* Preview Grid */}
      {files.length > 0 && (
        <div className="preview-grid">
          {files.map((f, i) => (
            <div key={i} className="preview-item">
              <img src={URL.createObjectURL(f)} alt={f.name} className="preview-thumb" />
              <button
                className="preview-remove"
                onClick={() => removeFile(i)}
                disabled={uploading}
              >
                ✕
              </button>
              <span className="preview-name">{f.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <p className="upload-progress">{progress}</p>
      )}

      {/* Upload Button */}
      <button
        className="btn-primary"
        onClick={handleUpload}
        disabled={uploading || files.length === 0}
      >
        {uploading ? progress : `Upload ${files.length} Image${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

/* ─── VIDEO UPLOAD ─── */
function VideoUpload({ toast, navigate }) {
  const [file, setFile] = useState(null)
  const [fps, setFps] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef()
  const pollRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('video/')) setFile(f)
  }

  const handleBrowse = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setStatus('Starting upload...')

    try {
      const formData = new FormData()
      formData.append('video', file)
      formData.append('fps', fps)
      formData.append('videoName', file.name)

      const res = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData
      })

      const { jobId } = await res.json()
      setStatus('Extracting frames with FFmpeg...')

      // Start polling
      pollRef.current = setInterval(async () => {
        const pollRes = await fetch(`/api/job/${jobId}`)
        const job = await pollRes.json()

        if (job.status === 'extracting') {
          setStatus('Extracting frames with FFmpeg...')
        } else if (job.status === 'uploading') {
          setStatus(`Uploading frames: ${job.progress} of ${job.total}`)
        } else if (job.status === 'complete') {
          clearInterval(pollRef.current)

          // Insert results into Supabase in batches of 500
          const BATCH = 500
          for (let i = 0; i < job.results.length; i += BATCH) {
            const rows = job.results.slice(i, i + BATCH).map(r => ({
              image_url: r.url,
              file_name: r.fileName,
              source_type: 'video',
              source_video_name: r.videoName,
              frame_number: r.frameNumber,
              status: 'pending'
            }))
            await supabase.from('annotations').insert(rows)
          }

          toast(`${job.results.length} frames uploaded!`, 'success')
          navigate('/annotate')
        } else if (job.status === 'error') {
          clearInterval(pollRef.current)
          toast('Video processing failed: ' + job.error, 'error')
          setUploading(false)
        }
      }, 1500)

    } catch (err) {
      toast('Upload failed: ' + err.message, 'error')
      setUploading(false)
    }
  }

  const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB'

  return (
    <div className="card">
      {!file ? (
        <div
          className="dropzone"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleBrowse}
          />
          <p className="dropzone-text">Drop a video here or click to browse</p>
          <p className="dropzone-hint">Supports MP4, MOV, AVI</p>
        </div>
      ) : (
        <div className="video-preview">
          <video src={URL.createObjectURL(file)} controls className="video-player" />
          <div className="video-meta">
            <span className="video-name">{file.name}</span>
            <span className="video-size">{formatSize(file.size)}</span>
          </div>

          {/* FPS Selector */}
          <div className="fps-selector">
            <label className="fps-label">Frames per second</label>
            <div className="fps-options">
              {[1, 2, 5, 10, 15, 24, 30].map(f => (
                <button
                  key={f}
                  className={`fps-btn ${fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                  disabled={uploading}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {uploading && (
            <p className="upload-progress">{status}</p>
          )}

          <div className="video-actions">
            <button
              className="btn-ghost"
              onClick={() => setFile(null)}
              disabled={uploading}
            >
              Remove
            </button>
            <button
              className="btn-primary"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? status : 'Extract & Upload Frames'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}