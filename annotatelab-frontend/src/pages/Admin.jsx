import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 50

export default function Admin() {
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const { toast } = useToast()

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const hasFilters = search || statusFilter || labelFilter || sourceFilter

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, labelFilter, sourceFilter])

  useEffect(() => {
    fetchData()
  }, [page, search, statusFilter, labelFilter, sourceFilter])

  const buildQuery = (query) => {
    if (search) query = query.ilike('file_name', `%${search}%`)
    if (statusFilter) query = query.eq('status', statusFilter)
    if (labelFilter) query = query.eq('label', labelFilter)
    if (sourceFilter) query = query.eq('source_type', sourceFilter)
    return query
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const [{ data, error }, { count }] = await Promise.all([
        buildQuery(supabase.from('annotations').select('*'))
          .order('created_at', { ascending: false })
          .range(from, to),
        buildQuery(supabase.from('annotations').select('*', { count: 'exact', head: true }))
      ])

      if (error) throw error
      setRows(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      toast('Failed to load data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete this record?\n\n${row.file_name}`
  )
  if (!confirmed) return

  setDeleting(row.id)
  try {
    // Step 1 — Delete from Cloudinary via backend
    const res = await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: row.file_name })
    })

    const data = await res.json()
    if (!data.success) throw new Error(data.error)

    // Step 2 — Delete from Supabase
    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', row.id)

    if (error) throw error

    // Step 3 — Remove from local state
    setRows(prev => prev.filter(r => r.id !== row.id))
    setTotalCount(prev => prev - 1)
    toast('Record deleted from database and storage!', 'success')
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error')
  } finally {
    setDeleting(null)
  }
}

  const handleExportCSV = async () => {
    try {
      toast('Preparing CSV...', 'info')
      const { data, error } = await buildQuery(
        supabase.from('annotations').select('*')
      ).order('created_at', { ascending: false })

      if (error) throw error

      const headers = [
        'id', 'image_url', 'file_name', 'source_type',
        'source_video_name', 'frame_number', 'label',
        'caption', 'labeled_by', 'labeled_at', 'status', 'created_at'
      ]

      const escape = (val) => {
        if (val === null || val === undefined) return '""'
        return `"${String(val).replace(/"/g, '""')}"`
      }

      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => escape(row[h])).join(','))
      ].join('\n')

      const date = new Date().toISOString().slice(0, 10)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `annotations_${date}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast('CSV exported!', 'success')
    } catch (err) {
      toast('Export failed: ' + err.message, 'error')
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const formatDate = (str) => {
    if (!str) return '—'
    return new Date(str).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Data View</h1>
          <p className="page-subtitle">
            <span className="mono">{totalCount}</span> total records
          </p>
        </div>
        <button className="btn-primary" onClick={handleExportCSV}>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          className="filter-input"
          placeholder="Search by filename..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="complete">Complete</option>
        </select>
        <select
          className="filter-select"
          value={labelFilter}
          onChange={e => setLabelFilter(e.target.value)}
        >
          <option value="">All Labels</option>
          <option value="engaged">Engaged</option>
          <option value="disengaged">Disengaged</option>
          <option value="neutral">Neutral</option>
        </select>
        <select
          className="filter-select"
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        {hasFilters && (
          <button className="btn-ghost" onClick={() => {
            setSearch('')
            setStatusFilter('')
            setLabelFilter('')
            setSourceFilter('')
          }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading ? (
          <div className="page-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No records found</p>
            <p className="empty-desc">Try adjusting your filters.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Filename</th>
                <th>Source</th>
                <th>Label</th>
                <th>Caption</th>
                <th>Labeled By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <a href={row.image_url} target="_blank" rel="noreferrer">
                      <img
                        src={row.image_url}
                        alt={row.file_name}
                        className="table-thumb"
                      />
                    </a>
                  </td>
                  <td>
                    <span className="mono table-filename">{row.file_name}</span>
                    {row.frame_number && (
                      <span className="meta-tag">Frame {row.frame_number}</span>
                    )}
                  </td>
                  <td>
                    <span className={`source-badge ${row.source_type}`}>
                      {row.source_type}
                    </span>
                  </td>
                  <td>
                    {row.label ? (
                      <span className={`label-badge ${row.label}`}>
                        {row.label}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className="table-caption">{row.caption || '—'}</span>
                  </td>
                  <td>
                    <span className="mono">
                      {row.labeled_by ? row.labeled_by.split('@')[0] : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="mono">{formatDate(row.labeled_at)}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={deleting === row.id}
                      style={{
                        background: 'transparent',
                        border: '1px solid #f43f5e',
                        color: '#f43f5e',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        opacity: deleting === row.id ? 0.5 : 1,
                        transition: 'all 0.15s'
                      }}
                    >
                      {deleting === row.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-ghost"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="pagination-info mono">
            Page {page} of {totalPages} — {totalCount} records
          </span>
          <button
            className="btn-ghost"
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
