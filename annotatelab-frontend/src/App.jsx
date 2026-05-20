import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Annotate from './pages/Annotate'
import Admin from './pages/Admin'
import Navbar from './components/Navbar'

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return (
    <>
      <Navbar user={user} />
      {children}
    </>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
  path="/"
  element={
    <ProtectedRoute user={user}>
      <Dashboard user={user} />
    </ProtectedRoute>
  }
/>
      <Route
        path="/upload"
        element={
          <ProtectedRoute user={user}>
            <Upload />
          </ProtectedRoute>
        }
      />
      <Route
  path="/annotate"
  element={
    <ProtectedRoute user={user}>
      <Annotate user={user} />
    </ProtectedRoute>
  }
/>
      <Route
        path="/admin"
        element={
          <ProtectedRoute user={user}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}