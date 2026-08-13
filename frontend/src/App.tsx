import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { ComingSoonPage } from './pages/ComingSoonPage'
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

function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<InviteAcceptancePage />} path="/accept-invite" />

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<DiaryPage />} path="diary" />
          <Route
            element={
              <ComingSoonPage
                description="Compare peso, avaliações e tendências ao longo do tempo."
                eyebrow="Histórico corporal"
                title="Evolução"
              />
            }
            path="progress"
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
