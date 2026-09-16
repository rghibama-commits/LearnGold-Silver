import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface RateRow {
  id: string;
  metal: 'GOLD' | 'SILVER';
  ratePerGram: string;
  source: string;
  effectiveAt: string;
}

export default function AdminRatesPage() {
  const [rates, setRates] = useState<RateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metal, setMetal] = useState<'GOLD' | 'SILVER'>('GOLD');
  const [ratePerGram, setRatePerGram] = useState('');
  const [source, setSource] = useState('Manually entered by admin');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .get<{ rates: RateRow[] }>('/admin/rates')
      .then((res) => setRates(res.rates))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load rates.'));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/admin/rates', { metal, ratePerGram: Number(ratePerGram), source });
      setRatePerGram('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the new rate.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Metal rates</h1>
      <p className="rate-note">
        Rates are manually entered per gram of pure metal (24K gold / 999 silver). They are not live market data — label
        the source accurately.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="filters-bar">
        <div className="field">
          <label htmlFor="metal">Metal</label>
          <select id="metal" value={metal} onChange={(e) => setMetal(e.target.value as 'GOLD' | 'SILVER')}>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ratePerGram">Rate per gram (pure metal)</label>
          <input id="ratePerGram" type="number" min={0} step="0.01" required value={ratePerGram} onChange={(e) => setRatePerGram(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="source">Source label</label>
          <input id="source" required value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add new rate'}
        </button>
      </form>

      {!rates && <LoadingSpinner label="Loading rate history…" />}
      {rates && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Metal</th>
              <th>Rate / g</th>
              <th>Source</th>
              <th>Effective from</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.metal}</td>
                <td>{Number(r.ratePerGram).toFixed(2)}</td>
                <td>{r.source}</td>
                <td>{new Date(r.effectiveAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
