import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function BrowsePage() {
  const { db } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: 'All',
    action: 'All',
    condition: 'All',
    location: '',
    maxTokens: '',
    sort: 'newest'
  });

  const items = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    const results = db.items
      .filter((item) => item.status === 'active')
      .filter((item) => !query || [item.title, item.description, item.category, item.location].some((value) => value.toLowerCase().includes(query)))
      .filter((item) => filters.category === 'All' || item.category === filters.category)
      .filter((item) => filters.action === 'All' || item.actionType === filters.action)
      .filter((item) => filters.condition === 'All' || item.condition === filters.condition)
      .filter((item) => !filters.location.trim() || item.location.toLowerCase().includes(filters.location.trim().toLowerCase()))
      .filter((item) => !filters.maxTokens || item.tokenPrice <= Number(filters.maxTokens));

    return [...results].sort((a, b) => {
      if (filters.sort === 'price-low') return a.tokenPrice - b.tokenPrice;
      if (filters.sort === 'price-high') return b.tokenPrice - a.tokenPrice;
      if (filters.sort === 'popular') return Number(b.views || 0) - Number(a.views || 0);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [db.items, filters]);

  const categories = ['All', ...new Set(db.items.map((item) => item.category))];
  const actions = ['All', 'Buy', 'Exchange', 'Donate'];
  const conditions = ['All', ...new Set(db.items.map((item) => item.condition))];

  function update(name, value) {
    const next = { ...filters, [name]: value };
    setFilters(next);
    if (name === 'q') setSearchParams(value ? { q: value } : {});
  }

  function clear() {
    setFilters({ q: '', category: 'All', action: 'All', condition: 'All', location: '', maxTokens: '', sort: 'newest' });
    setSearchParams({});
  }

  return (
    <section className="page-section page-width">
      <div className="page-heading marketplace-heading">
        <span className="eyebrow">Trusted electronics marketplace</span>
        <h1>Find technology ready for a second life</h1>
        <p>Search active listings, compare trusted sellers and use escrow-protected tokens for eligible purchases.</p>
      </div>

      <div className="filter-panel filter-panel-upgraded">
        <label className="search-field"><Search size={19} /><input value={filters.q} onChange={(event) => update('q', event.target.value)} placeholder="Search laptop, phone, console..." /></label>
        <select value={filters.category} onChange={(event) => update('category', event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={filters.action} onChange={(event) => update('action', event.target.value)}>{actions.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={filters.condition} onChange={(event) => update('condition', event.target.value)}>{conditions.map((value) => <option key={value}>{value}</option>)}</select>
        <input value={filters.location} onChange={(event) => update('location', event.target.value)} placeholder="City or area" />
        <input type="number" min="0" value={filters.maxTokens} onChange={(event) => update('maxTokens', event.target.value)} placeholder="Max E-Tokens" />
        <select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Newest first</option><option value="popular">Most viewed</option><option value="price-low">Lowest tokens</option><option value="price-high">Highest tokens</option></select>
        <button className="button button-ghost filter-clear" type="button" onClick={clear}><SlidersHorizontal size={17} /> Reset</button>
      </div>

      <div className="results-row"><span>{items.length} listing{items.length === 1 ? '' : 's'} found</span><span><Filter size={16} /> Active and available only</span></div>
      {items.length ? <div className="items-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <EmptyState icon={Search} title="No matching listings" description="Try changing your search, token limit or location." action={<button type="button" className="button button-primary" onClick={clear}>Clear filters</button>} />}
    </section>
  );
}
