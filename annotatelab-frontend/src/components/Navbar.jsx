import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Navbar({ user }) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const username = user?.email?.split('@')[0] || ''

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="navbar-brand">AnnotateLab</span>
      </div>

      <div className="navbar-center">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Dashboard
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Upload
        </NavLink>
        <NavLink to="/annotate" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Annotate
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Data View
        </NavLink>
      </div>

      <div className="navbar-right">
        <span className="navbar-user">{username}</span>
        <button className="btn-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </nav>
  )
}