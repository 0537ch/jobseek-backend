# API Documentation - IndoKerja.id Backend

Base URL: `http://localhost:3000`

## Authentication

Semua endpoint yang ditandai **[Auth]** memerlukan header:

```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### POST /auth/register

Register akun baru.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "JOB_SEEKER",
  "fullName": "John Doe",
  "companyName": "PT Maju (opsional, hanya untuk COMPANY)"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "JOB_SEEKER",
    "fullName": "John Doe",
    "companyName": null
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Validasi gagal (email invalid, password kosong, role invalid) |
| 409 | Email sudah terdaftar |

---

### POST /auth/login

Login dan dapatkan JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "JOB_SEEKER",
    "fullName": "John Doe",
    "companyName": null
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Validasi gagal |
| 401 | Email atau password salah |

---

### GET /auth/me **[Auth]**

Dapatkan data user yang sedang login.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "JOB_SEEKER",
  "fullName": "John Doe",
  "companyName": null,
  "createdAt": "2026-08-27T10:00:00.000Z"
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 401 | Token tidak valid / tidak ada token |

---

## Jobs Endpoints

### GET /jobs

Dapatkan semua lowongan (public). Bisa difilter.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| location | string | Filter lokasi (case-insensitive, partial match) |
| jobType | string | Filter tipe kerja: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Software Engineer",
    "description": "Build great software",
    "location": "Jakarta",
    "salaryMin": 5000000,
    "salaryMax": 10000000,
    "jobType": "FULL_TIME",
    "companyId": "uuid",
    "createdAt": "2026-08-27T10:00:00.000Z",
    "company": {
      "id": "uuid",
      "email": "company@example.com",
      "companyName": "PT Maju"
    }
  }
]
```

---

### GET /jobs/:id

Dapatkan detail satu lowongan.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Software Engineer",
  "description": "Build great software",
  "location": "Jakarta",
  "salaryMin": 5000000,
  "salaryMax": 10000000,
  "jobType": "FULL_TIME",
  "companyId": "uuid",
  "createdAt": "2026-08-27T10:00:00.000Z",
  "company": {
    "id": "uuid",
    "email": "company@example.com",
    "companyName": "PT Maju"
  },
  "_count": {
    "applications": 5
  }
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 400 | ID format bukan UUID |
| 404 | Lowongan tidak ditemukan |

---

### POST /jobs **[Auth: COMPANY]**

Buat lowongan baru.

**Request:**
```json
{
  "title": "Software Engineer",
  "description": "Build great software",
  "location": "Jakarta",
  "salaryMin": 5000000,
  "salaryMax": 10000000,
  "jobType": "FULL_TIME"
}
```

**Field:**
| Field | Required | Constraint |
|-------|----------|------------|
| title | Ya | Max 200 karakter |
| description | Ya | Max 5000 karakter |
| location | Ya | - |
| salaryMin | Tidak | Integer, >= 0 |
| salaryMax | Tidak | Integer, >= 0, harus >= salaryMin |
| jobType | Ya | Enum: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP |

**Response 201:** Object lowongan yang dibuat (sama seperti GET /jobs/:id tanpa _count)

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Validasi gagal |
| 401 | Tidak login |
| 403 | Role bukan COMPANY |

---

### PATCH /jobs/:id **[Auth: COMPANY]**

Update lowongan. Hanya bisa update lowongan sendiri.

**Request (semua field optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "location": "Bandung",
  "salaryMin": 6000000,
  "salaryMax": 12000000,
  "jobType": "PART_TIME"
}
```

**Response 200:** Object lowongan yang diupdate

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Validasi gagal |
| 403 | Bukan lowongan milik anda |
| 404 | Lowongan tidak ditemukan |

---

### GET /jobs/my/list **[Auth: COMPANY]**

Dapatkan semua lowongan milik company yang login, beserta jumlah pelamar.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Software Engineer",
    "description": "Build great software",
    "location": "Jakarta",
    "salaryMin": 5000000,
    "salaryMax": 10000000,
    "jobType": "FULL_TIME",
    "companyId": "uuid",
    "createdAt": "2026-08-27T10:00:00.000Z",
    "_count": {
      "applications": 5
    }
  }
]
```

---

### DELETE /jobs/:id **[Auth: COMPANY]**

Hapus lowongan. Hanya bisa hapus lowongan sendiri yang belum ada pelamar.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Software Engineer",
  ...
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Lowongan sudah ada pelamar |
| 403 | Bukan lowongan milik anda |
| 404 | Lowongan tidak ditemukan |

---

## Applications Endpoints

### POST /jobs/:jobId/apply **[Auth: JOB_SEEKER]**

Melamar ke suatu lowongan.

**Response 201:**
```json
{
  "id": "uuid",
  "jobId": "uuid",
  "jobSeekerId": "uuid",
  "status": "APPLIED",
  "appliedAt": "2026-08-27T10:00:00.000Z",
  "updatedAt": "2026-08-27T10:00:00.000Z",
  "job": {
    "id": "uuid",
    "title": "Software Engineer",
    "location": "Jakarta",
    "company": {
      "id": "uuid",
      "companyName": "PT Maju"
    }
  }
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 401 | Tidak login |
| 403 | Role bukan JOB_SEEKER |
| 404 | Lowongan tidak ditemukan |
| 409 | Sudah melamar ke lowongan ini |
| 403 | Tidak bisa melamar lowongan sendiri |

---

### GET /applications/my **[Auth: JOB_SEEKER]**

Dapatkan semua lamaran milik user yang login.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "jobId": "uuid",
    "jobSeekerId": "uuid",
    "status": "REVIEWING",
    "appliedAt": "2026-08-27T10:00:00.000Z",
    "updatedAt": "2026-08-27T11:00:00.000Z",
    "job": {
      "id": "uuid",
      "title": "Software Engineer",
      "location": "Jakarta",
      "jobType": "FULL_TIME",
      "salaryMin": 5000000,
      "salaryMax": 10000000,
      "company": {
        "id": "uuid",
        "companyName": "PT Maju"
      }
    }
  }
]
```

---

### GET /jobs/:jobId/applications **[Auth: COMPANY]**

Dapatkan semua pelamar untuk lowongan milik company yang login.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "jobId": "uuid",
    "jobSeekerId": "uuid",
    "status": "APPLIED",
    "appliedAt": "2026-08-27T10:00:00.000Z",
    "updatedAt": "2026-08-27T10:00:00.000Z",
    "jobSeeker": {
      "id": "uuid",
      "email": "seeker@example.com",
      "fullName": "John Doe"
    }
  }
]
```

**Errors:**
| Code | Cause |
|------|-------|
| 403 | Lowongan bukan milik company ini |
| 404 | Lowongan tidak ditemukan |

---

### PATCH /applications/:id/status **[Auth: COMPANY]**

Ubah status lamaran. Hanya bisa untuk pelamar di lowongan milik company yang login.

**Request:**
```json
{
  "status": "REVIEWING"
}
```

**Valid statuses:** APPLIED, REVIEWING, SHORTLISTED, REJECTED, ACCEPTED

**Response 200:**
```json
{
  "id": "uuid",
  "jobId": "uuid",
  "jobSeekerId": "uuid",
  "status": "REVIEWING",
  "appliedAt": "2026-08-27T10:00:00.000Z",
  "updatedAt": "2026-08-27T11:00:00.000Z",
  "job": {
    "id": "uuid",
    "title": "Software Engineer",
    "company": {
      "id": "uuid",
      "companyName": "PT Maju"
    }
  },
  "jobSeeker": {
    "id": "uuid",
    "email": "seeker@example.com",
    "fullName": "John Doe"
  }
}
```

**Errors:**
| Code | Cause |
|------|-------|
| 400 | Status enum tidak valid |
| 403 | Lamaran bukan di lowongan company ini |
| 404 | Lamaran tidak ditemukan |

**Catatan:** Setiap perubahan status otomatis tercatat di `ApplicationHistory`.

---

### GET /applications/:id/history **[Auth]**

Dapatkan riwayat perubahan status suatu lamaran. Bisa diakses oleh pelamar atau pemilik lowongan.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "applicationId": "uuid",
    "status": "REVIEWING",
    "changedAt": "2026-08-27T11:00:00.000Z",
    "changedBy": "company-uuid"
  },
  {
    "id": "uuid",
    "applicationId": "uuid",
    "status": "APPLIED",
    "changedAt": "2026-08-27T10:00:00.000Z",
    "changedBy": "seeker-uuid"
  }
]
```

**Errors:**
| Code | Cause |
|------|-------|
| 403 | Bukan pelamar atau pemilik lowongan |
| 404 | Lamaran tidak ditemukan |

---

## Error Response Format

Semua error mengikuti format:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password should not be empty"],
  "error": "Bad Request"
}
```

Untuk error validasi, `message` berisi array. Untuk error lain, `message` berisi string.

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validasi gagal) |
| 401 | Unauthorized (belum login / token invalid) |
| 403 | Forbidden (role tidak sesuai / bukan milik sendiri) |
| 404 | Not Found |
| 409 | Conflict (data duplikat) |
| 500 | Internal Server Error |
