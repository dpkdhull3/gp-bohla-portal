import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { YearProvider } from './context/YearContext'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const GrantsPage = lazy(() => import('./pages/GrantsPage').then((m) => ({ default: m.GrantsPage })))
const GrantDetailPage = lazy(() =>
  import('./pages/GrantDetailPage').then((m) => ({ default: m.GrantDetailPage })),
)
const PaymentsPage = lazy(() =>
  import('./pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
)
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })))
const DownloadsPage = lazy(() =>
  import('./pages/DownloadsPage').then((m) => ({ default: m.DownloadsPage })),
)
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)

function PageFallback() {
  return <p className="lede">…</p>
}

export default function App() {
  return (
    <YearProvider>
      <HashRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />

              <Route path="grants" element={<GrantsPage />} />
              <Route path="grants/:activityCode" element={<GrantDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />

              <Route path="funds" element={<Navigate to="/payments" replace />} />
              <Route path="funds/vouchers" element={<Navigate to="/payments" replace />} />
              <Route path="funds/schemes" element={<Navigate to="/payments" replace />} />

              {/* Preserved deep links from former Works section */}
              <Route path="works" element={<Navigate to="/grants" replace />} />
              <Route
                path="works/plans"
                element={<Navigate to={{ pathname: '/grants', search: '?view=pdf' }} replace />}
              />

              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/downloads" element={<DownloadsPage />} />
              <Route path="reports/audit" element={<AuditPage />} />
              <Route path="reports/about" element={<AboutPage />} />

              <Route path="home/year" element={<Navigate to="/" replace />} />
              <Route path="vouchers" element={<Navigate to="/payments" replace />} />
              <Route path="schemes" element={<Navigate to="/payments" replace />} />
              <Route path="downloads" element={<Navigate to="/reports/downloads" replace />} />
              <Route path="audit" element={<Navigate to="/reports/audit" replace />} />
              <Route path="about" element={<Navigate to="/reports/about" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </YearProvider>
  )
}
