import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { DiaryPage } from './pages/DiaryPage'
import { FoodDetailPage } from './pages/FoodDetailPage'
import { FoodsPage } from './pages/FoodsPage'
import { HomePage } from './pages/HomePage'
import { InviteAcceptancePage } from './pages/InviteAcceptancePage'
import { LoginPage } from './pages/LoginPage'
import { NewFoodPage } from './pages/NewFoodPage'
import { NewRecipePage } from './pages/NewRecipePage'
import { NutritionGoalsPage } from './pages/NutritionGoalsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipesPage } from './pages/RecipesPage'
import { TdeeSettingsPage } from './pages/TdeeSettingsPage'
import './App.css'

const WeightProgressPage = lazy(() => import('./pages/WeightProgressPage').then((module) => ({ default: module.WeightProgressPage })))
const WorkoutsPage = lazy(() => import('./pages/WorkoutsPage').then((module) => ({ default: module.WorkoutsPage })))

function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<InviteAcceptancePage />} path="/accept-invite" />

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<DiaryPage />} path="diary" />
          <Route element={<Navigate replace to="/progress/weight" />} path="progress" />
          <Route
            element={<Suspense fallback={<div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando peso…</p></div>}><WeightProgressPage /></Suspense>}
            path="progress/weight"
          />
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
        </Route>
      </Route>

      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

export default App
