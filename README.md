# IndoKerja.id - Backend API

Job Application Management API untuk platform IndoKerja.id. Dibangun dengan NestJS, Prisma ORM, dan PostgreSQL.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** NestJS 11
- **ORM:** Prisma 7 (dengan driver adapter `@prisma/adapter-pg`)
- **Database:** PostgreSQL
- **Auth:** JWT (jsonwebtoken) + Passport.js
- **Validation:** class-validator + class-transformer
- **Testing:** Jest + Supertest

## Fitur

- Autentikasi JWT (register/login)
- Role-based access control (Job Seeker & Company)
- CRUD Lowongan Pekerjaan
- Sistem Lamaran dengan status tracking
- Application History (audit trail setiap perubahan status)
- Input validation & proper error handling

## Persiapan

### Prerequisites

- Node.js >= 18
- PostgreSQL running
- npm atau yarn

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variable

Buat file `.env` di root backend:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/jobseek?schema=public"
JWT_SECRET="your-secret-key-here"
PORT=3000
```

### 3. Database migration

```bash
npx prisma migrate dev
```

### 4. Jalankan server

```bash
# development
npm run start:dev

# production
npm run build
npm run start:prod
```

Server berjalan di `http://localhost:3000`

## Testing

```bash
# unit tests (68 tests)
npm test

# e2e tests (122 tests)
npm run test:e2e

# test coverage
npm run test:cov

# lint
npm run lint
```

## Struktur Project

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── auth/                   # Authentication module
│   │   ├── decorators/         # @CurrentUser, @Roles
│   │   ├── dto/                # RegisterDto, LoginDto
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   └── jwt.strategy.ts
│   ├── jobs/                   # Jobs module
│   │   ├── dto/                # CreateJobDto
│   │   ├── jobs.controller.ts
│   │   ├── jobs.module.ts
│   │   └── jobs.service.ts
│   ├── applications/           # Applications module
│   │   ├── dto/                # UpdateStatusDto
│   │   ├── applications.controller.ts
│   │   ├── applications.module.ts
│   │   └── applications.service.ts
│   ├── prisma/                 # Prisma module
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── app.module.ts
│   └── main.ts
└── test/
    ├── app.e2e-spec.ts         # Flow E2E tests (35 tests)
    ├── security.e2e-spec.ts    # Security E2E tests (87 tests)
    └── jest-e2e.json
```

## API Documentation

Lihat [API.md](./API.md) untuk dokumentasi endpoint lengkap.

## Database Schema

```
User (1) ──── (many) Job         # Company membuat lowongan
User (1) ──── (many) Application # Job Seeker melamar
Job  (1) ──── (many) Application # Lowongan dilamar
Application (1) ── (many) ApplicationHistory  # Audit trail
```

**Enums:**
- `Role`: JOB_SEEKER, COMPANY
- `JobType`: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP
- `ApplicationStatus`: APPLIED, REVIEWING, SHORTLISTED, REJECTED, ACCEPTED

## License

MIT
