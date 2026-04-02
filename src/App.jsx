import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider, ProtectedRoute, AdminLogin } from './components/AdminAuth';
import { ClientAuthProvider, ClientProtectedRoute, ClientLogin } from './components/ClientAuth';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Dashboard from './pages/Dashboard';
import Tracker from './pages/Tracker';
import Report from './pages/Report';
import Proposal from './pages/Proposal';
import Monitor from './pages/Monitor';
import Contracts from './pages/Contracts';
import ClientPortal from './pages/ClientPortal';
import Contact from './pages/Contact';

function NotFound() {
  return (
    <main style={{ paddingTop: '72px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '12px' }}>404</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Page not found.</p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    </main>
  );
}

function AppLayout() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/portal');

  return (
    <>
      {!isPortal && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contact" element={<Contact />} />

        {/* Admin login */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route path="/tracker" element={<ProtectedRoute><Tracker /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        <Route path="/proposal" element={<ProtectedRoute><Proposal /></ProtectedRoute>} />
        <Route path="/monitor" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />

        {/* Client portal */}
        <Route path="/portal" element={<ClientLogin />} />
        <Route path="/portal/dashboard" element={<ClientProtectedRoute><ClientPortal /></ClientProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isPortal && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ClientAuthProvider>
          <AppLayout />
        </ClientAuthProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
