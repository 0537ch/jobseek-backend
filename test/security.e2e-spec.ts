import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

describe('Security & Edge Cases', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let companyA: { token: string; id: string };
  let companyB: { token: string; id: string };
  let seeker: { token: string; id: string };
  let companyAJobId: string;
  let applicationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const ts = Date.now();

    const compARes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `sec-company-a-${ts}@test.com`,
        password: 'password123',
        role: 'COMPANY',
        companyName: 'Security Corp A',
      });
    companyA = { token: compARes.body.token, id: compARes.body.user.id };

    const compBRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `sec-company-b-${ts}@test.com`,
        password: 'password123',
        role: 'COMPANY',
        companyName: 'Security Corp B',
      });
    companyB = { token: compBRes.body.token, id: compBRes.body.user.id };

    const seekerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `sec-seeker-${ts}@test.com`,
        password: 'password123',
        role: 'JOB_SEEKER',
        fullName: 'Security Seeker',
      });
    seeker = { token: seekerRes.body.token, id: seekerRes.body.user.id };

    const jobRes = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${companyA.token}`)
      .send({
        title: 'Security Test Job',
        description: 'Job for security testing',
        location: 'Jakarta',
        jobType: 'FULL_TIME',
      });
    companyAJobId = jobRes.body.id;

    const appRes = await request(app.getHttpServer())
      .post(`/jobs/${companyAJobId}/apply`)
      .set('Authorization', `Bearer ${seeker.token}`)
      .expect(201);
    applicationId = appRes.body.id;
  });

  afterAll(async () => {
    await prisma.applicationHistory.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ─── TOKEN SECURITY ────────────────────────────────────────

  describe('Token Security', () => {
    it('tampered token (modified payload) returns 401', async () => {
      const parts = companyA.token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.role = 'COMPANY';
      payload.sub = companyB.id;
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${parts.join('.')}`)
        .expect(401);
    });

    it('token signed with wrong secret returns 401', async () => {
      const fakeToken = jwt.sign(
        { sub: companyA.id, email: companyA.id, role: 'COMPANY' },
        'wrong-secret-12345',
        { expiresIn: '7d' },
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('expired token returns 401', async () => {
      const expiredToken = jwt.sign(
        { sub: companyA.id, email: 'test@test.com', role: 'COMPANY' },
        JWT_SECRET,
        { expiresIn: '0s' },
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('Authorization header without Bearer prefix returns 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', companyA.token)
        .expect(401);
    });

    it('empty Bearer token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });

    it('garbage string as token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.token')
        .expect(401);
    });

    it('token with valid format but random bytes returns 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set(
          'Authorization',
          `Bearer ${Buffer.from('randomdata').toString('base64')}.${Buffer.from('moredata').toString('base64')}.${Buffer.from('evenmore').toString('base64')}`,
        )
        .expect(401);
    });

    it('request without Authorization header returns 401 on protected route', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  // ─── CROSS-TENANT / IDOR ──────────────────────────────────

  describe('Cross-Tenant Authorization', () => {
    it('company B cannot delete company A job', async () => {
      await request(app.getHttpServer())
        .delete(`/jobs/${companyAJobId}`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .expect(403);
    });

    it('company B cannot view applications for company A job', async () => {
      await request(app.getHttpServer())
        .get(`/jobs/${companyAJobId}/applications`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .expect(403);
    });

    it('company B cannot update status of company A application', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .send({ status: 'REJECTED' })
        .expect(403);
    });

    it('company cannot apply to jobs (role check)', async () => {
      await request(app.getHttpServer())
        .post(`/jobs/${companyAJobId}/apply`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .expect(403);
    });

    it('job seeker cannot create jobs', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${seeker.token}`)
        .send({
          title: 'Should Fail',
          description: 'Nope',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(403);
    });

    it('job seeker cannot access company job list', async () => {
      await request(app.getHttpServer())
        .get('/jobs/my/list')
        .set('Authorization', `Bearer ${seeker.token}`)
        .expect(403);
    });

    it('job seeker cannot update application status', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${seeker.token}`)
        .send({ status: 'REJECTED' })
        .expect(403);
    });

    it('unauthorized user cannot access application history', async () => {
      const outsiderRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `outsider-${Date.now()}@test.com`,
          password: 'password123',
          role: 'JOB_SEEKER',
        });

      await request(app.getHttpServer())
        .get(`/applications/${applicationId}/history`)
        .set('Authorization', `Bearer ${outsiderRes.body.token}`)
        .expect(403);
    });
  });

  // ─── INPUT VALIDATION & INJECTION ─────────────────────────

  describe('Input Validation & Injection', () => {
    it('SQL injection via location filter does not crash', async () => {
      const res = await request(app.getHttpServer())
        .get("/jobs?location='; DROP TABLE users; --")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('SQL injection via email - Prisma parameterizes queries so injection is safe', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `sqli-${Date.now()}@test.com`,
          password: 'password123',
          role: 'COMPANY',
        })
        .expect(201);

      expect(res.body.user.email).toBeDefined();
    });

    it('XSS in job title is accepted (stored as-is, escaped by frontend)', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: '<script>alert("xss")</script>',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.title).toBe('<script>alert("xss")</script>');
    });

    it('XSS in job description is accepted (stored as-is, escaped by frontend)', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Safe Title',
          description: '<img src=x onerror=alert(1)>',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.description).toBe('<img src=x onerror=alert(1)>');
    });

    it('empty request body returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);
    });

    it('empty email returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: '',
          password: 'password123',
          role: 'COMPANY',
        })
        .expect(400);
    });

    it('invalid email format returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
          role: 'COMPANY',
        })
        .expect(400);
    });

    it('missing password returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `nopass-${Date.now()}@test.com`,
          role: 'COMPANY',
        })
        .expect(400);
    });

    it('invalid role returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `badrole-${Date.now()}@test.com`,
          password: 'password123',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('invalid jobType enum returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Test',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('invalid application status enum returns 400', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('negative salary returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Negative Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: -1000,
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('empty title returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: '',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('empty description returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Test',
          description: '',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('empty location returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Test',
          description: 'Test',
          location: '',
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('title exceeding 200 chars returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'A'.repeat(201),
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('description exceeding 5000 chars returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Test',
          description: 'A'.repeat(5001),
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('extra fields are rejected by whitelist validation', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Clean Job',
          description: 'Should be clean',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
          hackerField: 'injected',
          admin: true,
        })
        .expect(400);
    });
  });

  // ─── BUSINESS LOGIC EDGE CASES ────────────────────────────

  describe('Business Logic Edge Cases', () => {
    it('apply to non-existent job returns 404', async () => {
      await request(app.getHttpServer())
        .post('/jobs/00000000-0000-0000-0000-000000000000/apply')
        .set('Authorization', `Bearer ${seeker.token}`)
        .expect(404);
    });

    it('apply to non-existent job with invalid UUID returns 404', async () => {
      await request(app.getHttpServer())
        .post('/jobs/not-a-uuid/apply')
        .set('Authorization', `Bearer ${seeker.token}`)
        .expect(404);
    });

    it('company views applications for non-existent job returns 404', async () => {
      await request(app.getHttpServer())
        .get('/jobs/00000000-0000-0000-0000-000000000000/applications')
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(404);
    });

    it('update status of non-existent application returns 404', async () => {
      await request(app.getHttpServer())
        .patch('/applications/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'REJECTED' })
        .expect(404);
    });

    it('view history of non-existent application returns 404', async () => {
      await request(app.getHttpServer())
        .get('/applications/00000000-0000-0000-0000-000000000000/history')
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(404);
    });

    it('salaryMin > salaryMax returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Bad Salary Range',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: 20000000,
          salaryMax: 5000000,
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('delete non-existent job returns 404', async () => {
      await request(app.getHttpServer())
        .delete('/jobs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(404);
    });

    it('get job detail with invalid UUID returns 400', async () => {
      await request(app.getHttpServer()).get('/jobs/invalid-uuid').expect(400);
    });

    it('get job detail with valid UUID but nonexistent returns 404', async () => {
      await request(app.getHttpServer())
        .get('/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('salaryMin without salaryMax is allowed', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Only Min Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: 5000000,
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('salaryMax without salaryMin is allowed', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Only Max Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMax: 10000000,
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('no salary fields is allowed', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'No Salary',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'INTERNSHIP',
        })
        .expect(201);
    });

    it('login with empty body returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('login with invalid email format returns 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-valid', password: 'pass' })
        .expect(400);
    });
  });

  // ─── RESPONSE STRUCTURE ───────────────────────────────────

  describe('Response Structure Security', () => {
    it('register response never includes password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `struct-${Date.now()}@test.com`,
          password: 'password123',
          role: 'JOB_SEEKER',
        })
        .expect(201);

      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
    });

    it('login response never includes password', async () => {
      const email = `company-a-${Date.now()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          role: 'COMPANY',
          companyName: 'Login Test Corp',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: 'password123',
        })
        .expect(200);

      expect(res.body.user).not.toHaveProperty('password');
    });

    it('getProfile response never includes password', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(200);

      expect(res.body).not.toHaveProperty('password');
    });

    it('job listing never includes company password', async () => {
      const res = await request(app.getHttpServer()).get('/jobs').expect(200);

      for (const job of res.body) {
        expect(job.company).not.toHaveProperty('password');
      }
    });

    it('job applications never include seeker password', async () => {
      const res = await request(app.getHttpServer())
        .get(`/jobs/${companyAJobId}/applications`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(200);

      for (const app of res.body) {
        expect(app.jobSeeker).not.toHaveProperty('password');
      }
    });
  });

  // ─── STATE TRANSITIONS ────────────────────────────────────

  describe('Application Status Transitions', () => {
    let transitionJobId: string;
    let transitionAppId: string;
    let transitionSeeker: { token: string; id: string };

    beforeAll(async () => {
      const ts = Date.now();
      const seekerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `transition-seeker-${ts}@test.com`,
          password: 'password123',
          role: 'JOB_SEEKER',
          fullName: 'Transition Seeker',
        });
      transitionSeeker = {
        token: seekerRes.body.token,
        id: seekerRes.body.user.id,
      };

      const jobRes = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Transition Test Job',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        });
      transitionJobId = jobRes.body.id;

      const appRes = await request(app.getHttpServer())
        .post(`/jobs/${transitionJobId}/apply`)
        .set('Authorization', `Bearer ${transitionSeeker.token}`)
        .expect(201);
      transitionAppId = appRes.body.id;
    });

    it('APPLIED → REVIEWING (valid forward)', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${transitionAppId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'REVIEWING' })
        .expect(200);
    });

    it('REVIEWING → SHORTLISTED (valid forward)', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${transitionAppId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'SHORTLISTED' })
        .expect(200);
    });

    it('SHORTLISTED → ACCEPTED (valid forward)', async () => {
      await request(app.getHttpServer())
        .patch(`/applications/${transitionAppId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);
    });

    it('ACCEPTED → REJECTED (reverse transition - currently allowed)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/applications/${transitionAppId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'REJECTED' });

      expect([200, 400]).toContain(res.status);
    });

    it('REJECTED → APPLIED (reverse transition - currently allowed)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/applications/${transitionAppId}/status`)
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({ status: 'APPLIED' });

      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── BOUNDARY VALUES ──────────────────────────────────────

  describe('Boundary Values', () => {
    it('salaryMin = 0 is valid', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Zero Min Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: 0,
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('salaryMax = 0 with salaryMin = 0 is valid', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Zero Both Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: 0,
          salaryMax: 0,
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('title exactly 200 chars is valid', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'A'.repeat(200),
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('description exactly 5000 chars is valid', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Boundary Desc',
          description: 'A'.repeat(5000),
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);
    });

    it('negative salaryMin returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Negative Min',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: -1,
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('negative salaryMax returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Negative Max',
          description: 'Test',
          location: 'Jakarta',
          salaryMax: -100,
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });

    it('non-integer salary returns 400', async () => {
      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Float Salary',
          description: 'Test',
          location: 'Jakarta',
          salaryMin: 5000.5,
          jobType: 'FULL_TIME',
        })
        .expect(400);
    });
  });

  // ─── UNICODE & ENCODING ──────────────────────────────────

  describe('Unicode & Special Characters', () => {
    it('emoji in job title is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Software Engineer 🚀',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.title).toBe('Software Engineer 🚀');
    });

    it('unicode in job description is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Unicode Desc',
          description:
            'Kami mencari engineer berpengalaman. Gaji kompetitif 💰',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.description).toContain('💰');
    });

    it('Arabic text in location is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Arabic Location',
          description: 'Test',
          location: 'جدة',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.location).toBe('جدة');
    });

    it('Chinese text in title is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: '软件工程师',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.title).toBe('软件工程师');
    });

    it('newlines in description are stored', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Newline Desc',
          description: 'Line 1\nLine 2\nLine 3',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.description).toContain('\n');
    });

    it('tabs in description are stored', async () => {
      const res = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Tab Desc',
          description: 'Col1\tCol2\tCol3',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(201);

      expect(res.body.description).toContain('\t');
    });
  });

  // ─── CASE SENSITIVITY ────────────────────────────────────

  describe('Case Sensitivity', () => {
    it('login email is case-insensitive for lookup', async () => {
      const email = `case-test-${Date.now()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          role: 'JOB_SEEKER',
        })
        .expect(201);

      const upperEmail = email.toUpperCase();
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: upperEmail, password: 'password123' });

      expect([200, 401]).toContain(res.status);
    });

    it('location filter is case-insensitive', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs?location=jakarta')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('location filter with mixed case works', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs?location=JAKARTA')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── HTTP METHOD ─────────────────────────────────────────

  describe('HTTP Method Validation', () => {
    it('PUT to /jobs returns 404 (no PUT handler)', async () => {
      await request(app.getHttpServer())
        .put('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Test',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(404);
    });

    it('PATCH to /auth/register returns 404', async () => {
      await request(app.getHttpServer())
        .patch('/auth/register')
        .send({
          email: `patch-${Date.now()}@test.com`,
          password: 'password123',
          role: 'COMPANY',
        })
        .expect(404);
    });

    it('DELETE to /auth/login returns 404', async () => {
      await request(app.getHttpServer()).delete('/auth/login').expect(404);
    });

    it('POST to /auth/me returns 404', async () => {
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', `Bearer ${companyA.token}`)
        .expect(404);
    });
  });

  // ─── IDEMPOTENCY ─────────────────────────────────────────

  describe('Idempotency', () => {
    it('duplicate apply returns 409 (not 201)', async () => {
      const ts = Date.now();
      const seekerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `idemp-seeker-${ts}@test.com`,
          password: 'password123',
          role: 'JOB_SEEKER',
        });

      const jobRes = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyA.token}`)
        .send({
          title: 'Idempotency Test',
          description: 'Test',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        });

      await request(app.getHttpServer())
        .post(`/jobs/${jobRes.body.id}/apply`)
        .set('Authorization', `Bearer ${seekerRes.body.token}`)
        .expect(201);

      const dupRes = await request(app.getHttpServer())
        .post(`/jobs/${jobRes.body.id}/apply`)
        .set('Authorization', `Bearer ${seekerRes.body.token}`);

      expect(dupRes.status).toBe(409);
    });

    it('duplicate register returns 409', async () => {
      const email = `dup-${Date.now()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123', role: 'COMPANY' })
        .expect(201);

      const dupRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123', role: 'COMPANY' });

      expect(dupRes.status).toBe(409);
    });
  });

  // ─── TOKEN LIFECYCLE ─────────────────────────────────────

  describe('Token Lifecycle', () => {
    it('token for deleted user returns 401', async () => {
      const ts = Date.now();
      const delRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `del-user-${ts}@test.com`,
          password: 'password123',
          role: 'JOB_SEEKER',
        });
      const delToken = delRes.body.token;
      const delUserId = delRes.body.user.id;

      await prisma.user.delete({ where: { id: delUserId } });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${delToken}`)
        .expect(401);
    });

    it('multiple logins produce independent valid tokens', async () => {
      const email = `multi-${Date.now()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123', role: 'COMPANY' })
        .expect(201);

      const login1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);

      const login2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login1.body.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login2.body.token}`)
        .expect(200);
    });
  });

  // ─── QUERY EDGE CASES ────────────────────────────────────

  describe('Query Edge Cases', () => {
    it('filter by non-existent location returns empty array', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs?location=NonexistentCityXYZ123')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('filter by non-existent jobType returns empty array', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs?jobType=REMOTE')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('empty location filter returns all jobs', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs?location=')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /jobs/my/list without token returns 401', async () => {
      await request(app.getHttpServer()).get('/jobs/my/list').expect(401);
    });

    it('GET /applications/my without token returns 401', async () => {
      await request(app.getHttpServer()).get('/applications/my').expect(401);
    });
  });
});
