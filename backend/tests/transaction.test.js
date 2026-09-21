const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

async function getToken() {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Tester', email: 'tx@flare.demo', password: 'password123',
  });
  return res.body.token;
}

const sampleTxn = {
  referenceId: 'TXN-TEST-1',
  sourceSystem: 'internal_ledger',
  amount: 100,
  transactionDate: new Date().toISOString(),
  description: 'Test transaction',
  counterparty: 'Test Vendor',
  status: 'completed',
};

describe('Transaction CRUD', () => {
  it('creates a transaction', async () => {
    const token = await getToken();
    const res = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(sampleTxn);
    expect(res.status).toBe(201);
    expect(res.body.data.referenceId).toBe('TXN-TEST-1');
    expect(res.body.data.reconciliationStatus).toBe('unmatched');
  });

  it('rejects creation with missing required fields', async () => {
    const token = await getToken();
    const res = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ amount: 50 });
    expect(res.status).toBe(400);
  });

  it('lists transactions with pagination', async () => {
    const token = await getToken();
    await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(sampleTxn);
    const res = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('filters transactions by search term', async () => {
    const token = await getToken();
    await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(sampleTxn);
    const res = await request(app).get('/api/transactions?search=TXN-TEST-1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('updates a transaction', async () => {
    const token = await getToken();
    const created = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(sampleTxn);
    const res = await request(app)
      .put(`/api/transactions/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(250);
  });

  it('deletes a transaction', async () => {
    const token = await getToken();
    const created = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(sampleTxn);
    const res = await request(app).delete(`/api/transactions/${created.body.data._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/transactions/${created.body.data._id}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });
});
