import StatusBadge from './StatusBadge';

// Renders one transaction as a table row. Kept dumb/presentational -
// all data fetching lives in the parent TransactionList.
export default function TransactionItem({ transaction, onEdit, onDelete }) {
  const t = transaction;
  return (
    <tr>
      <td>{t.referenceId}</td>
      <td>{t.sourceSystem.replace(/_/g, ' ')}</td>
      <td>{t.currency} {Number(t.amount).toFixed(2)}</td>
      <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
      <td>{t.counterparty || '—'}</td>
      <td><StatusBadge value={t.status} /></td>
      <td><StatusBadge value={t.reconciliationStatus} /></td>
      <td>
        <button className="secondary" style={{ marginRight: 6 }} onClick={() => onEdit(t)}>Edit</button>
        <button className="danger-link" onClick={() => onDelete(t)}>Delete</button>
      </td>
    </tr>
  );
}
