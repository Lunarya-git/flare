import Layout from '../components/Layout';
import TransactionList from '../components/TransactionList';

export default function TransactionsPage() {
  return (
    <Layout title="Financial Records">
      <TransactionList />
    </Layout>
  );
}
