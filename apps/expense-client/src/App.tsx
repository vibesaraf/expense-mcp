import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Callback } from './pages/Callback'
import { MyExpenses } from './pages/MyExpenses'
import { SubmitExpense } from './pages/SubmitExpense'
import { TeamExpenses } from './pages/TeamExpenses'
import { Reports } from './pages/Reports'
import { Activity } from './pages/Activity'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<Callback />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/expenses/me" replace />} />
              <Route path="/expenses/me" element={<MyExpenses />} />
              <Route path="/expenses/submit" element={<SubmitExpense />} />
              <Route path="/activity" element={<Activity />} />

              <Route element={<ProtectedRoute roles={['manager', 'finance_admin']} />}>
                <Route path="/expenses/team" element={<TeamExpenses />} />
              </Route>
              <Route element={<ProtectedRoute roles={['finance_admin']} />}>
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
