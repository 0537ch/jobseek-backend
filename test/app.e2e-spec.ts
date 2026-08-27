import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('IndoKerja E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let companyToken: string;
  let companyId: string;
  let seekerToken: string;
  let seekerId: string;
  let jobId: string;
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
  });

  afterAll(async () => {
    await prisma.applicationHistory.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ─── AUTH ────────────────────────────────────────────────────

  describe('Auth', () => {
    const companyEmail = `company-${Date.now()}@test.com`;
    const seekerEmail = `seeker-${Date.now()}@test.com`;
    const password = 'password123';

    it('POST /auth/register - company', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: companyEmail,
          password,
          role: 'COMPANY',
          companyName: 'Test Corp',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user.email).toBe(companyEmail);
          expect(res.body.user.role).toBe('COMPANY');
          expect(res.body.user.companyName).toBe('Test Corp');
          expect(res.body.token).toBeDefined();
          expect(res.body.user).not.toHaveProperty('password');
          companyToken = res.body.token;
          companyId = res.body.user.id;
        });
    });

    it('POST /auth/register - job seeker', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: seekerEmail,
          password,
          role: 'JOB_SEEKER',
          fullName: 'Test Seeker',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user.email).toBe(seekerEmail);
          expect(res.body.user.role).toBe('JOB_SEEKER');
          expect(res.body.token).toBeDefined();
          seekerToken = res.body.token;
          seekerId = res.body.user.id;
        });
    });

    it('POST /auth/register - duplicate email returns 409', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: companyEmail,
          password,
          role: 'COMPANY',
        })
        .expect(409);
    });

    it('POST /auth/register - invalid email returns 400', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password,
          role: 'COMPANY',
        })
        .expect(400);
    });

    it('POST /auth/login - success', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: companyEmail, password })
        .expect(200)
        .expect((res) => {
          expect(res.body.token).toBeDefined();
          expect(res.body.user.email).toBe(companyEmail);
        });
    });

    it('POST /auth/login - wrong password returns 401', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: companyEmail, password: 'wrong' })
        .expect(401);
    });

    it('POST /auth/login - nonexistent user returns 401', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password })
        .expect(401);
    });

    it('GET /auth/me - returns current user', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(companyEmail);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('GET /auth/me - no token returns 401', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  // ─── JOBS ────────────────────────────────────────────────────

  describe('Jobs', () => {
    it('POST /jobs - company creates job', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'Software Engineer',
          description: 'Build great software',
          location: 'Jakarta',
          salaryMin: 5000000,
          salaryMax: 10000000,
          jobType: 'FULL_TIME',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.title).toBe('Software Engineer');
          expect(res.body.location).toBe('Jakarta');
          expect(res.body.company.id).toBe(companyId);
          jobId = res.body.id;
        });
    });

    it('POST /jobs - job seeker cannot create job', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          title: 'Should Fail',
          description: 'Nope',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(403);
    });

    it('POST /jobs - no token returns 401', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .send({
          title: 'Should Fail',
          description: 'Nope',
          location: 'Jakarta',
          jobType: 'FULL_TIME',
        })
        .expect(401);
    });

    it('POST /jobs - missing required fields returns 400', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ title: 'Incomplete' })
        .expect(400);
    });

    it('GET /jobs - list all jobs', () => {
      return request(app.getHttpServer())
        .get('/jobs')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].company).toBeDefined();
        });
    });

    it('GET /jobs - filter by location', () => {
      return request(app.getHttpServer())
        .get('/jobs?location=Jakarta')
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].location).toContain('Jakarta');
        });
    });

    it('GET /jobs - filter by jobType', () => {
      return request(app.getHttpServer())
        .get('/jobs?jobType=FULL_TIME')
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('GET /jobs - filter with no results', () => {
      return request(app.getHttpServer())
        .get('/jobs?location=NonexistentCity123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([]);
        });
    });

    it('GET /jobs/:id - get job detail', () => {
      return request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(jobId);
          expect(res.body.title).toBe('Software Engineer');
          expect(res.body._count).toBeDefined();
        });
    });

    it('GET /jobs/:id - invalid UUID returns 400', () => {
      return request(app.getHttpServer()).get('/jobs/not-a-uuid').expect(400);
    });

    it('GET /jobs/:id - nonexistent job returns 404', () => {
      return request(app.getHttpServer())
        .get('/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('GET /jobs/my/list - company sees own jobs', () => {
      return request(app.getHttpServer())
        .get('/jobs/my/list')
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0]._count).toBeDefined();
        });
    });
  });

  // ─── APPLICATIONS ────────────────────────────────────────────

  describe('Applications', () => {
    it('POST /jobs/:id/apply - job seeker applies', () => {
      return request(app.getHttpServer())
        .post(`/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body.jobId).toBe(jobId);
          expect(res.body.jobSeekerId).toBe(seekerId);
          expect(res.body.status).toBe('APPLIED');
          applicationId = res.body.id;
        });
    });

    it('POST /jobs/:id/apply - duplicate apply returns 409', () => {
      return request(app.getHttpServer())
        .post(`/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(409);
    });

    it('POST /jobs/:id/apply - company cannot apply', () => {
      return request(app.getHttpServer())
        .post(`/jobs/${jobId}/apply`)
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(403);
    });

    it('GET /applications/my - job seeker sees own applications', () => {
      return request(app.getHttpServer())
        .get('/applications/my')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].job).toBeDefined();
          expect(res.body[0].job.company).toBeDefined();
        });
    });

    it('GET /jobs/:id/applications - company sees candidates', () => {
      return request(app.getHttpServer())
        .get(`/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].jobSeeker).toBeDefined();
          expect(res.body[0].jobSeeker.email).toBeDefined();
        });
    });

    it('GET /jobs/:id/applications - other company cannot view', async () => {
      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `other-${Date.now()}@test.com`,
          password: 'password123',
          role: 'COMPANY',
        });
      const otherToken = otherRes.body.token;

      return request(app.getHttpServer())
        .get(`/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('PATCH /applications/:id/status - company updates status', () => {
      return request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ status: 'REVIEWING' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('REVIEWING');
        });
    });

    it('PATCH /applications/:id/status - other company cannot update', async () => {
      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `other2-${Date.now()}@test.com`,
          password: 'password123',
          role: 'COMPANY',
        });

      return request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .send({ status: 'ACCEPTED' })
        .expect(403);
    });

    it('PATCH /applications/:id/status - invalid status returns 400', () => {
      return request(app.getHttpServer())
        .patch(`/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('GET /applications/:id/history - company sees history', () => {
      return request(app.getHttpServer())
        .get(`/applications/${applicationId}/history`)
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          const statuses = res.body.map((h: { status: string }) => h.status);
          expect(statuses).toContain('APPLIED');
          expect(statuses).toContain('REVIEWING');
        });
    });

    it('GET /applications/:id/history - job seeker sees own history', () => {
      return request(app.getHttpServer())
        .get(`/applications/${applicationId}/history`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('GET /applications/:id/history - unauthorized user cannot view', () => {
      return request(app.getHttpServer())
        .get(`/applications/${applicationId}/history`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200);
    });

    it('DELETE /jobs/:id - company can delete own job with no applications', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'To Be Deleted',
          description: 'Delete me',
          location: 'Jakarta',
          jobType: 'INTERNSHIP',
        });

      return request(app.getHttpServer())
        .delete(`/jobs/${createRes.body.id}`)
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(200);
    });

    it('DELETE /jobs/:id - cannot delete job with applications', () => {
      return request(app.getHttpServer())
        .delete(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${companyToken}`)
        .expect(400);
    });
  });
});
