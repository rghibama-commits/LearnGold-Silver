export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '2rem', justifyContent: 'center' }}>
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
