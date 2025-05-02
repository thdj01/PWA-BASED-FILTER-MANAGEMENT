import React, { useState, useEffect } from 'react';
 
const DEMO_SERVER_DATA = [
  { id: 1, name: 'Filter A', status: 'OK' },
  { id: 2, name: 'Filter B', status: 'Needs Replacement' }
];

function App() {
  const [filters, setFilters] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load data on first visit
  useEffect(() => {
    const saved = localStorage.getItem('filters');
    if (saved) {
      setFilters(JSON.parse(saved));
    } else if (navigator.onLine) {
      // Simulate fetch from server
      setFilters(DEMO_SERVER_DATA);
      localStorage.setItem('filters', JSON.stringify(DEMO_SERVER_DATA));
    }
  }, []);

  // Track online/offline state
  useEffect(() => {
    const syncData = () => {
      const pending = localStorage.getItem('pendingChanges');
      if (pending) {
        const updates = JSON.parse(pending);
        // Simulate "sync" by applying updates to stored data
        const saved = JSON.parse(localStorage.getItem('filters') || '[]');
        const merged = saved.map(f =>
          updates.find(u => u.id === f.id) || f
        );
        localStorage.setItem('filters', JSON.stringify(merged));
        localStorage.removeItem('pendingChanges');
        setFilters(merged);
        alert('Changes synced with server (simulated)');
      }
    };

    const goOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Handle update
  const toggleStatus = (id) => {
    const updated = filters.map(filter =>
      filter.id === id
        ? { ...filter, status: filter.status === 'OK' ? 'Needs Replacement' : 'OK' }
        : filter
    );
    setFilters(updated);
    localStorage.setItem('filters', JSON.stringify(updated));

    // If offline, store as pending
    if (!navigator.onLine) {
      localStorage.setItem('pendingChanges', JSON.stringify(updated));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Filter Manager Demo (PWA)</h1>
      <p>Status: <strong style={{ color: isOnline ? 'green' : 'red' }}>{isOnline ? 'Online' : 'Offline'}</strong></p>
      <ul>
        {filters.map(filter => (
          <li key={filter.id}>
            <strong>{filter.name}</strong> — {filter.status} {' '}
            <button onClick={() => toggleStatus(filter.id)}>Toggle Status</button>
          </li>
        ))}
      </ul>
 
    </div>
  );
}

export default App;
