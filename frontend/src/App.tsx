import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { OwnerRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { UnexpectedUnauthorizedBoundary } from './auth/UnexpectedUnauthorizedBoundary'
import { ToastProvider } from './components/Toast'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { DiaryPage } from './pages/DiaryPage'
import { FoodDetailPage } from './pages/FoodDetailPage'
import { FoodsPage } from './pages/FoodsPage'
import { HomePage } from './pages/HomePage'
import { InviteAcceptancePage } from './pages/InviteAcceptancePage'
import { InvitationsPage } from './pages/InvitationsPage'
import { NewFoodPage } from './pages/NewFoodPage'
import { NewRecipePage } from './pages/NewRecipePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NutritionGoalsPage } from './pages/NutritionGoalsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipesPage } from './pages/RecipesPage'
import { TdeeSettingsPage } from './pages/TdeeSettingsPage'
import './App.css'

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const WeightProgressPage = lazy(() => import('./pages/WeightProgressPage').then((module) => ({ default: module.WeightProgressPage })))
const WorkoutsPage = lazy(() => import('./pages/WorkoutsPage').then((module) => ({ default: module.WorkoutsPage })))
const BodyEvaluationsPage = lazy(() => import('./pages/BodyEvaluationsPage').then((module) => ({ default: module.BodyEvaluationsPage })))
const NewBodyEvaluationPage = lazy(() => import('./pages/NewBodyEvaluationPage').then((module) => ({ default: module.NewBodyEvaluationPage })))
const BodyEvaluationDetailPage = lazy(() => import('./pages/BodyEvaluationDetailPage').then((module) => ({ default: module.BodyEvaluationDetailPage })))
const BodyEvaluationComparisonPage = lazy(() => import('./pages/BodyEvaluationComparisonPage').then((module) => ({ default: module.BodyEvaluationComparisonPage })))
const MonthlyAnalyticsPage = lazy(() => import('./pages/MonthlyAnalyticsPage').then((module) => ({ default: module.MonthlyAnalyticsPage })))
const AnalyticsChartsPage = lazy(() => import('./pages/AnalyticsChartsPage').then((module) => ({ default: module.AnalyticsChartsPage })))

function LazyRoute({ label, children }: { label: string; children: ReactNode }) {
  return <Suspense fallback={<div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando {label}…</p></div>}>{children}</Suspense>
}

function App() {
  return (
    <ToastProvider><UnexpectedUnauthorizedBoundary><Routes>
      <Route element={<LazyRoute label="acesso"><LoginPage /></LazyRoute>} path="/login" />
      <Route element={<InviteAcceptancePage />} path="/accept-invite" />

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<DiaryPage />} path="diary" />
          <Route element={<Navigate replace to="/progress/evaluations" />} path="progress" />
          <Route
            element={<Suspense fallback={<div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando peso…</p></div>}><WeightProgressPage /></Suspense>}
            path="progress/weight"
          />
          <Route element={<LazyRoute label="avaliações"><BodyEvaluationsPage /></LazyRoute>} path="progress/evaluations" />
          <Route element={<LazyRoute label="nova avaliação"><NewBodyEvaluationPage /></LazyRoute>} path="progress/evaluations/new" />
          <Route element={<LazyRoute label="comparação"><BodyEvaluationComparisonPage /></LazyRoute>} path="progress/evaluations/compare" />
          <Route element={<LazyRoute label="avaliação"><BodyEvaluationDetailPage /></LazyRoute>} path="progress/evaluations/:id" />
          <Route element={<Navigate replace to="/analytics/monthly" />} path="analytics" />
          <Route element={<LazyRoute label="resumo mensal"><MonthlyAnalyticsPage /></LazyRoute>} path="analytics/monthly" />
          <Route element={<LazyRoute label="gráficos"><AnalyticsChartsPage /></LazyRoute>} path="analytics/charts" />
          <Route
            element={<Suspense fallback={<div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando treinos…</p></div>}><WorkoutsPage /></Suspense>}
            path="workouts"
          />
          <Route element={<ProfilePage />} path="profile" />
          <Route element={<FoodsPage />} path="foods" />
          <Route element={<NewFoodPage />} path="foods/new" />
          <Route element={<FoodDetailPage />} path="foods/:id" />
          <Route element={<RecipesPage />} path="recipes" />
          <Route element={<NewRecipePage />} path="recipes/new" />
          <Route element={<RecipeDetailPage />} path="recipes/:id" />
          <Route element={<NutritionGoalsPage />} path="settings/nutrition-goals" />
          <Route element={<TdeeSettingsPage />} path="settings/tdee" />
          <Route element={<OwnerRoute />}>
            <Route element={<InvitationsPage />} path="settings/invitations" />
          </Route>
          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Route>
    </Routes></UnexpectedUnauthorizedBoundary></ToastProvider>
  )
}

export default App
