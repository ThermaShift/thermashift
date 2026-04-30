import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider, ProtectedRoute, AdminLogin } from './components/AdminAuth';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Dashboard from './pages/Dashboard';
import Tracker from './pages/Tracker';
import Report from './pages/Report';
import Proposal from './pages/Proposal';
import Contracts from './pages/Contracts';
import Content from './pages/Content';
import Saas from './pages/Saas';
import Contact from './pages/Contact';
import ChatWidget from './components/ChatWidget';

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
  const isSaas = location.pathname.startsWith('/saas');

  return (
    <>
      {!isSaas && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/contact" element={<Contact />} />

        {/* Admin login */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route path="/tracker" element={<ProtectedRoute><Tracker /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        <Route path="/proposal" element={<ProtectedRoute><Proposal /></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />

        <Route path="/content" element={<ProtectedRoute><Content /></ProtectedRoute>} />

        {/* Monitoring SaaS — api_key based, no auth wrapper (page handles its own) */}
        <Route path="/saas" element={<Saas />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isSaas && <Footer />}
      {!isSaas && <ChatWidget />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
