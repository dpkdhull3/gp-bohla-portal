import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { YearProvider } from './context/YearContext'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const WorksPage = lazy(() => import('./pages/WorksPage').then((m) => ({ default: m.WorksPage })))
const PlansPage = lazy(() => import('./pages/PlansPage').then((m) => ({ default: m.PlansPage })))
const SchemesPage = lazy(() =>
  import('./pages/SchemesPage').then((m) => ({ default: m.SchemesPage })),
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

              <Route path="funds" element={<Navigate to="/funds/schemes" replace />} />
              <Route path="funds/vouchers" element={<Navigate to="/works" replace />} />
              <Route path="funds/schemes" element={<SchemesPage />} />

              <Route path="works" element={<WorksPage />} />
              <Route path="works/plans" element={<PlansPage />} />

              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/downloads" element={<DownloadsPage />} />
              <Route path="reports/audit" element={<AuditPage />} />
              <Route path="reports/about" element={<AboutPage />} />

              {/* Preserved deep links */}
              <Route path="home/year" element={<Navigate to="/" replace />} />
              <Route path="vouchers" element={<Navigate to="/works" replace />} />
              <Route path="schemes" element={<Navigate to="/funds/schemes" replace />} />
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
