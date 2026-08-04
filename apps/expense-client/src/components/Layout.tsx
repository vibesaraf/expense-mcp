import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  const isManager = user?.roles.some(r => r === 'manager' || r === 'finance_admin') ?? false
  const isFinanceAdmin = user?.roles.includes('finance_admin') ?? false

  return (
    <>
      <nav className="nav">
        <div className="nav-brand-group">
          <NavLink to="/expenses/me" className="nav-brand">Expenses</NavLink>
          {user && <span className="nav-user-email" title={user.email}>{user.email}</span>}
        </div>
        <div className="nav-links">
          <NavLink
            to="/expenses/me"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            My Expenses
          </NavLink>
          {isManager && (
            <NavLink
              to="/expenses/team"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Team Expenses
            </NavLink>
          )}
          {isFinanceAdmin && (
            <NavLink
              to="/reports"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Reports
            </NavLink>
          )}
          <NavLink
            to="/activity"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Activity
          </NavLink>
          <button type="button" className="nav-link" onClick={() => { void logout() }}>
            Sign out
          </button>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  )
}
