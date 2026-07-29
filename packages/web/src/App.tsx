import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JoinPage from './pages/JoinPage';
import DashboardPage from './pages/DashboardPage';
import ChoresPage from './pages/ChoresPage';
import MealsPage from './pages/MealsPage';
import SchedulePage from './pages/SchedulePage';
import RewardsPage from './pages/RewardsPage';
import ChatPage from './pages/ChatPage';
import ReportPage from './pages/ReportPage';
import QuestsPage from './pages/QuestsPage';
import GroceryPage from './pages/GroceryPage';
import SettingsPage from './pages/SettingsPage';
import GamesPage from './pages/GamesPage';
import WishlistPage from './pages/WishlistPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="chores" element={<ChoresPage />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

