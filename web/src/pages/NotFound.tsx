import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="verify-shell">
      <div className="verify-card">
        <div className="verify-head">
          <div className="brand-mark" style={{ margin: '0 auto 12px' }}>Q</div>
          <h1>Page not found</h1>
          <p>The page you asked for does not exist on this platform.</p>
        </div>
        <div className="verify-body center stack" style={{ gap: 10 }}>
          <Link to="/" className="btn btn-primary btn-block">
            Student home
          </Link>
          <Link to="/admin" className="btn btn-subtle btn-block">
            Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
