import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Interviews from './pages/Interviews';
import Analytics from './pages/Analytics';
import Network from './pages/Network';
import Profile from './pages/Profile';
import Login from './pages/Login';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAppContext();
  const location = useLocation();

  if (loading) {
    // Loading: the page's shape in slate, not a spinner or a word.
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-12 placeholder" />
        <div className="h-40 placeholder" />
        <div className="h-64 placeholder" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AppProvider>
        {/* Toasts as house callouts: a panel with a left rule in the state's colour. */}
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              background: 'rgb(var(--panel-lit))', color: 'rgb(var(--ink))', borderRadius: 0,
              border: '2px solid rgb(var(--engrave))', borderLeft: '6px solid rgb(var(--arc))',
              boxShadow: 'none', fontFamily: 'Archivo, system-ui, sans-serif',
            },
            success: { iconTheme: { primary: 'rgb(var(--arc))', secondary: 'rgb(var(--ground))' } },
            error: {
              style: { borderLeft: '6px solid rgb(var(--gold))' },
              iconTheme: { primary: 'rgb(var(--gold))', secondary: 'rgb(var(--ground))' },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <Layout>
                  <Applications />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews"
            element={
              <ProtectedRoute>
                <Layout>
                  <Interviews />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/network"
            element={
              <ProtectedRoute>
                <Layout>
                  <Network />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AppProvider>
    </Router>
  );
}

export default App;