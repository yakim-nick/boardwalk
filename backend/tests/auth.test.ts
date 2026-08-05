import request from 'supertest';
import { buildTestApp, registerUser, resetDb, TestContext } from './helpers';

describe('Auth API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a user and returns a JWT', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .send({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'Password123' })
        .expect(201);

      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('ada@example.com');
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.name).toBe('Ada Lovelace');
    });

    it('rejects duplicate email addresses', async () => {
      await registerUser(ctx, { email: 'dup@example.com' });
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .send({ name: 'Someone', email: 'dup@example.com', password: 'Password123' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects weak passwords', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .send({ name: 'Weak', email: 'weak@example.com', password: 'short' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid emails', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .send({ name: 'Bad', email: 'not-an-email', password: 'Password123' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
      await registerUser(ctx, { email: 'login@example.com', password: 'Password123' });
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'Password123' })
        .expect(200);
      expect(res.body.data.token).toBeDefined();
    });

    it('rejects wrong password', async () => {
      await registerUser(ctx, { email: 'wrong@example.com', password: 'Password123' });
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@example.com', password: 'WrongPassword1' })
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unknown email with a generic error', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123' })
        .expect(401);
      expect(res.body.error.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the authenticated user', async () => {
      const { token, userId, email } = await registerUser(ctx, { email: 'me@example.com' });
      const res = await request(ctx.app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.user.id).toBe(userId);
      expect(res.body.data.user.email).toBe(email);
    });

    it('returns 401 without a token', async () => {
      const res = await request(ctx.app).get('/api/v1/auth/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with a garbage token', async () => {
      const res = await request(ctx.app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer garbage.token.value')
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
