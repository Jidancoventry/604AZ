import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <section className="page-section page-width"><div className="empty-state not-found"><strong>404</strong><h1>Page not found</h1><p>The page you requested does not exist in this prototype.</p><Link className="button button-primary" to="/"><Home size={18} /> Return home</Link></div></section>;
}
