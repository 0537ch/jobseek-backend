import 'dotenv/config';
import { PrismaClient, Role, JobType, ApplicationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  // ─── USERS ──────────────────────────────────────────────

  const companies = await Promise.all([
    prisma.user.create({
      data: {
        email: 'hr@tokopedia.com',
        password,
        role: Role.COMPANY,
        companyName: 'Tokopedia',
      },
    }),
    prisma.user.create({
      data: {
        email: 'hiring@google.com',
        password,
        role: Role.COMPANY,
        companyName: 'Google Indonesia',
      },
    }),
    prisma.user.create({
      data: {
        email: 'careers@goto.com',
        password,
        role: Role.COMPANY,
        companyName: 'GoTo',
      },
    }),
    prisma.user.create({
      data: {
        email: 'hr@bukalapak.com',
        password,
        role: Role.COMPANY,
        companyName: 'Bukalapak',
      },
    }),
  ]);

  const seekers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'andi@gmail.com',
        password,
        role: Role.JOB_SEEKER,
        fullName: 'Andi Pratama',
      },
    }),
    prisma.user.create({
      data: {
        email: 'sari@gmail.com',
        password,
        role: Role.JOB_SEEKER,
        fullName: 'Sari Dewi',
      },
    }),
    prisma.user.create({
      data: {
        email: 'budi@gmail.com',
        password,
        role: Role.JOB_SEEKER,
        fullName: 'Budi Santoso',
      },
    }),
    prisma.user.create({
      data: {
        email: 'maya@gmail.com',
        password,
        role: Role.JOB_SEEKER,
        fullName: 'Maya Anggraeni',
      },
    }),
    prisma.user.create({
      data: {
        email: 'raka@gmail.com',
        password,
        role: Role.JOB_SEEKER,
        fullName: 'Raka Putra',
      },
    }),
  ]);

  console.log(`Created ${companies.length} companies, ${seekers.length} seekers`);

  // ─── JOBS ───────────────────────────────────────────────

  const jobs = await Promise.all([
    // Tokopedia jobs
    prisma.job.create({
      data: {
        title: 'Senior Frontend Engineer',
        description: 'Kami mencari Senior Frontend Engineer yang berpengalaman untuk membangun dan mengoptimalkan antarmuka pengguna Tokopedia. Tech stack: React, TypeScript, Next.js.\n\nKualifikasi:\n- 3+ tahun pengalaman frontend\n- Mahir React & TypeScript\n- Pengalaman dengan performance optimization\n- Familiar dengan CI/CD',
        location: 'Jakarta',
        salaryMin: 15000000,
        salaryMax: 30000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[0].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Backend Engineer - Payments',
        description: 'Bergabung dengan tim Payments untuk membangun sistem pembayaran yang skalabel dan aman. Tech stack: Go, PostgreSQL, Redis.\n\nKualifikasi:\n- 2+ tahun pengalaman backend\n- Mahir Go atau Java\n- Paham microservices architecture\n- Pengalaman dengan payment gateway adalah nilai tambah',
        location: 'Jakarta',
        salaryMin: 12000000,
        salaryMax: 25000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[0].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'UI/UX Designer',
        description: 'Cari UI/UX Designer kreatif untuk mendesain pengalaman pengguna yang intuitif untuk produk Tokopedia.\n\nKualifikasi:\n- 2+ tahun pengalaman UI/UX\n- Mahir Figma\n- Memahami design system\n- Portfolio yang baik',
        location: 'Jakarta',
        salaryMin: 8000000,
        salaryMax: 15000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[0].id,
      },
    }),

    // Google jobs
    prisma.job.create({
      data: {
        title: 'Software Engineer - Cloud',
        description: 'Work on Google Cloud Platform products serving millions of users worldwide. We are looking for engineers who can build scalable distributed systems.\n\nQualifications:\n- BS/MS in Computer Science or equivalent\n- Strong coding skills in Java, C++, or Go\n- Experience with distributed systems\n- Good communication skills in English',
        location: 'Bandung',
        salaryMin: 25000000,
        salaryMax: 50000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[1].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Data Analyst Intern',
        description: 'Join Google Indonesia as a Data Analyst Intern. Analyze user behavior and provide insights for product decisions.\n\nRequirements:\n- Currently pursuing BS/MS in relevant field\n- Proficient in SQL and Python\n- Experience with data visualization tools\n- Available for 6 months minimum',
        location: 'Jakarta',
        salaryMin: 5000000,
        salaryMax: 8000000,
        jobType: JobType.INTERNSHIP,
        companyId: companies[1].id,
      },
    }),

    // GoTo jobs
    prisma.job.create({
      data: {
        title: 'DevOps Engineer',
        description: 'Tim DevOps GoTo mencari engineer untuk mengelola infrastruktur cloud dan CI/CD pipeline.\n\nKualifikasi:\n- 2+ tahun pengalaman DevOps/SRE\n- Mahir Kubernetes & Docker\n- Pengalaman AWS/GCP\n- Paham Infrastructure as Code (Terraform)',
        location: 'Jakarta',
        salaryMin: 15000000,
        salaryMax: 28000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[2].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Mobile Developer (Flutter)',
        description: 'Bergabung dengan tim mobile GoTo untuk mengembangkan aplikasi Flutter yang digunakan jutaan pengguna.\n\nKualifikasi:\n- 1+ tahun pengalaman Flutter/Dart\n- Paham state management (BLoC, Provider)\n- Pengalaman REST API integration\n- Memahami mobile app architecture',
        location: 'Yogyakarta',
        salaryMin: 10000000,
        salaryMax: 20000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[2].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'QA Engineer - Part Time',
        description: 'Cari QA Engineer part time untuk melakukan manual dan automated testing produk GoTo.\n\nKualifikasi:\n- 1+ tahun pengalaman QA\n- Mahir testing tools (Selenium, Cypress)\n- Detail-oriented\n- Bekerja 20 jam per minggu',
        location: 'Remote',
        salaryMin: 5000000,
        salaryMax: 10000000,
        jobType: JobType.PART_TIME,
        companyId: companies[2].id,
      },
    }),

    // Bukalapak jobs
    prisma.job.create({
      data: {
        title: 'Fullstack Developer',
        description: 'Bukalapak mencari Fullstack Developer yang bisa bekerja di frontend dan backend untuk membangun fitur baru marketplace.\n\nKualifikasi:\n- 2+ tahun pengalaman fullstack\n- React/Vue + Node.js/Go\n- Paham database (PostgreSQL/MySQL)\n- Agile mindset',
        location: 'Jakarta',
        salaryMin: 12000000,
        salaryMax: 22000000,
        jobType: JobType.FULL_TIME,
        companyId: companies[3].id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Backend Developer - Contract',
        description: 'Butuh Backend Developer untuk project 6 bulan. Membangun API baru untuk fitur GoPay.\n\nKualifikasi:\n- 3+ tahun pengalaman backend\n- Mahir Go atau Java\n- Pengalaman dengan payment system\n- Tersedia untuk kontrak 6 bulan',
        location: 'Jakarta',
        salaryMin: 15000000,
        salaryMax: 25000000,
        jobType: JobType.CONTRACT,
        companyId: companies[3].id,
      },
    }),
  ]);

  console.log(`Created ${jobs.length} jobs`);

  // ─── APPLICATIONS ───────────────────────────────────────

  const applications = await Promise.all([
    // Andi applies to Tokopedia Frontend
    prisma.application.create({
      data: {
        jobId: jobs[0].id,
        jobSeekerId: seekers[0].id,
        status: ApplicationStatus.REVIEWING,
      },
    }),
    // Sari applies to Tokopedia Frontend
    prisma.application.create({
      data: {
        jobId: jobs[0].id,
        jobSeekerId: seekers[1].id,
        status: ApplicationStatus.APPLIED,
      },
    }),
    // Budi applies to Tokopedia Payments
    prisma.application.create({
      data: {
        jobId: jobs[1].id,
        jobSeekerId: seekers[2].id,
        status: ApplicationStatus.SHORTLISTED,
      },
    }),
    // Maya applies to Google Cloud
    prisma.application.create({
      data: {
        jobId: jobs[3].id,
        jobSeekerId: seekers[3].id,
        status: ApplicationStatus.APPLIED,
      },
    }),
    // Raka applies to Google Intern
    prisma.application.create({
      data: {
        jobId: jobs[4].id,
        jobSeekerId: seekers[4].id,
        status: ApplicationStatus.REVIEWING,
      },
    }),
    // Andi applies to GoTo DevOps
    prisma.application.create({
      data: {
        jobId: jobs[5].id,
        jobSeekerId: seekers[0].id,
        status: ApplicationStatus.ACCEPTED,
      },
    }),
    // Sari applies to Bukalapak Fullstack
    prisma.application.create({
      data: {
        jobId: jobs[8].id,
        jobSeekerId: seekers[1].id,
        status: ApplicationStatus.REJECTED,
      },
    }),
    // Budi applies to GoTo Flutter
    prisma.application.create({
      data: {
        jobId: jobs[6].id,
        jobSeekerId: seekers[2].id,
        status: ApplicationStatus.APPLIED,
      },
    }),
  ]);

  console.log(`Created ${applications.length} applications`);

  // ─── APPLICATION HISTORY ────────────────────────────────

  const histories = await Promise.all([
    // Andi - Tokopedia Frontend: APPLIED → REVIEWING
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[0].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[0].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[0].id,
        status: ApplicationStatus.REVIEWING,
        changedBy: companies[0].id,
      },
    }),
    // Sari - Tokopedia Frontend: APPLIED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[1].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[1].id,
      },
    }),
    // Budi - Tokopedia Payments: APPLIED → REVIEWING → SHORTLISTED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[2].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[2].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[2].id,
        status: ApplicationStatus.REVIEWING,
        changedBy: companies[0].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[2].id,
        status: ApplicationStatus.SHORTLISTED,
        changedBy: companies[0].id,
      },
    }),
    // Maya - Google Cloud: APPLIED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[3].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[3].id,
      },
    }),
    // Raka - Google Intern: APPLIED → REVIEWING
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[4].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[4].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[4].id,
        status: ApplicationStatus.REVIEWING,
        changedBy: companies[1].id,
      },
    }),
    // Andi - GoTo DevOps: APPLIED → REVIEWING → SHORTLISTED → ACCEPTED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[5].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[0].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[5].id,
        status: ApplicationStatus.REVIEWING,
        changedBy: companies[2].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[5].id,
        status: ApplicationStatus.SHORTLISTED,
        changedBy: companies[2].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[5].id,
        status: ApplicationStatus.ACCEPTED,
        changedBy: companies[2].id,
      },
    }),
    // Sari - Bukalapak Fullstack: APPLIED → REVIEWING → REJECTED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[6].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[1].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[6].id,
        status: ApplicationStatus.REVIEWING,
        changedBy: companies[3].id,
      },
    }),
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[6].id,
        status: ApplicationStatus.REJECTED,
        changedBy: companies[3].id,
      },
    }),
    // Budi - GoTo Flutter: APPLIED
    prisma.applicationHistory.create({
      data: {
        applicationId: applications[7].id,
        status: ApplicationStatus.APPLIED,
        changedBy: seekers[2].id,
      },
    }),
  ]);

  console.log(`Created ${histories.length} application history records`);

  console.log('\nSeed completed!');
  console.log('\n--- Test Accounts ---');
  console.log('All passwords: password123');
  console.log('\nCompanies:');
  companies.forEach((c) => console.log(`  ${c.email} (${c.companyName})`));
  console.log('\nJob Seekers:');
  seekers.forEach((s) => console.log(`  ${s.email} (${s.fullName})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
