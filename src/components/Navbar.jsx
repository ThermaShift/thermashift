import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const links = [
    { to: '/', label: 'Home' },
    { to: '/calculator', label: 'ROI Calculator' },
    { to: '/dashboard', label: 'Dashboard Demo' },
    { to: '/report', label: 'Report Generator' },
  ];

  return (
    <nav className="nav">
      <div className="container">
        <Link to="/" className="nav-logo">
          Therma<span>Shift</span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
        <ul className={`nav-links ${open ? 'open' : ''}`}>
          {links.map(({ to, label }) => (
            <li key={to}>
              <Link to={to} className={isActive(to)} onClick={() => setOpen(false)}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/contact" className="btn btn-primary" onClick={() => setOpen(false)}>
              Get a Free Audit
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
