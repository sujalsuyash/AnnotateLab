import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (error) {
      toast(error.message, 'error')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">AnnotateLab</h1>
          <p className="login-desc">
            A lightweight image annotation tool for research teams.
            Label images, extract video frames, and export training data.
          </p>
        </div>

        <button
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}