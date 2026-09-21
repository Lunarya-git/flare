// Small reusable presentational component used across the app to render
// any status/severity string as a color-coded pill.
export default function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${value}`}>{value.replace(/_/g, ' ')}</span>;
}
