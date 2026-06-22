import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  const isManager = user?.roles.some(r => r === 'manager' || r === 'finance_admin') ?? false
  const isFinanceAdmin = user?.roles.includes('finance_admin') ?? false

  return (
    <>
      <nav>
        <Link to="/expenses/me">My Expenses</Link>
        <Link to="/expenses/submit">Submit Expense</Link>
        {isManager && <Link to="/expenses/team">Team Expenses</Link>}
        {isFinanceAdmin && <Link to="/reports">Reports</Link>}
        <Link to="/activity">Activity</Link>
        <button type="button" onClick={() => { void logout() }}>
          Sign out
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  )
}
