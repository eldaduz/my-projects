import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import './shared/ui.css';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ProtectedLayout } from './layout/ProtectedLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { TravelerProfilesPage } from './traveler-profiles/TravelerProfilesPage.jsx';
import { TripsPage } from './trips/TripsPage.jsx';
import { TripWizardPage } from './trips/TripWizardPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/trips" replace />} />
            <Route path="/traveler-profiles" element={<TravelerProfilesPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripWizardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
