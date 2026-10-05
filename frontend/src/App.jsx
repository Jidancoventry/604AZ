import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminPage from './pages/AdminPage.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import CreateItemPage from './pages/CreateItemPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import EditItemPage from './pages/EditItemPage.jsx';
import ItemDetailsPage from './pages/ItemDetailsPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import MyItemsPage from './pages/MyItemsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import PublicProfilePage from './pages/PublicProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RecyclingPage from './pages/RecyclingPage.jsx';
import WalletPage from './pages/WalletPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/items/:itemId" element={<ItemDetailsPage />} />
        <Route path="/users/:userId" element={<PublicProfilePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/my-items" element={<ProtectedRoute><MyItemsPage /></ProtectedRoute>} />
        <Route path="/create-item" element={<ProtectedRoute><CreateItemPage /></ProtectedRoute>} />
        <Route path="/edit-item/:itemId" element={<ProtectedRoute><EditItemPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/recycling" element={<ProtectedRoute><RecyclingPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
