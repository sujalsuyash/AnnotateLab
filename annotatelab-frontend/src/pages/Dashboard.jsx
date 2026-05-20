import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    complete: 0,
    engaged: 0,
    disengaged: 0,
    neutral: 0
  })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const username = user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [
        { count: total },
        { count: pending },
        { count: complete },
        { count: engaged },
        { count: disengaged },
        { count: neutral },
        { data: recentData }
      ] = await Promise.all([
        supabase.from('annotations').select('*', { count: 'exact', head: true }),
        supabase.from('annotations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('annotations').select('*', { count: 'exact', head: true }).eq('status', 'complete'),
        supabase.from('annotations').select('*', { count: 'exact', head: true }).eq('label', 'engaged'),
        supabase.from('annotations').select('*', { count: 'exact', head: true }).eq('label', 'disengaged'),
        supabase.from('annotations').select('*', { count: 'exact', head: true }).eq('label', 'neutral'),
        supabase.from('annotations').select('*').eq('status', 'complete').order('labeled_at', { ascending: false }).limit(6)
      ])

      setStats({ total, pending, complete, engaged, disengaged, neutral })
      setRecent(recentData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = stats.total > 0
    ? Math.round((stats.complete / stats.total) * 100)
    : 0

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {username}</h1>
          <p className="page-subtitle">Here's what's happening with your dataset.</p>
        </div>
        <div className="header-actions">
          <Link to="/upload" className="btn-primary">Upload</Link>
          <Link to="/annotate" className="btn-primary">
            Annotate {stats.pending > 0 && `(${stats.pending} pending)`}
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Images</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <span className="stat-value stat-pending">{stats.pending}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <span className="stat-value stat-complete">{stats.complete}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Overall Progress</span>
          <span className="progress-percent">{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Label Distribution */}
      {stats.complete > 0 && (
        <div className="card">
          <h2 className="card-title">Label Distribution</h2>
          <div className="distribution">
            <div className="dist-row">
              <span className="dist-label engaged">Engaged</span>
              <div className="dist-track">
                <div className="dist-fill engaged-fill"
                  style={{ width: `${Math.round((stats.engaged / stats.complete) * 100)}%` }} />
              </div>
              <span className="dist-count">{stats.engaged}</span>
            </div>
            <div className="dist-row">
              <span className="dist-label disengaged">Disengaged</span>
              <div className="dist-track">
                <div className="dist-fill disengaged-fill"
                  style={{ width: `${Math.round((stats.disengaged / stats.complete) * 100)}%` }} />
              </div>
              <span className="dist-count">{stats.disengaged}</span>
            </div>
            <div className="dist-row">
              <span className="dist-label neutral">Neutral</span>
              <div className="dist-track">
                <div className="dist-fill neutral-fill"
                  style={{ width: `${Math.round((stats.neutral / stats.complete) * 100)}%` }} />
              </div>
              <span className="dist-count">{stats.neutral}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Annotations */}
      {stats.total === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No images yet</p>
          <p className="empty-desc">Upload some images or videos to get started.</p>
          <Link to="/upload" className="btn-primary">Go to Upload</Link>
        </div>
      ) : recent.length > 0 && (
        <div className="card">
          <h2 className="card-title">Recently Labeled</h2>
          <div className="recent-grid">
            {recent.map(item => (
              <div key={item.id} className="recent-card">
                <img src={item.image_url} alt={item.file_name} className="recent-thumb" />
                <div className="recent-info">
                  <span className={`label-badge ${item.label}`}>{item.label}</span>
                  <span className="recent-filename">{item.file_name}</span>
                  <span className="recent-by">{item.labeled_by?.split('@')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}