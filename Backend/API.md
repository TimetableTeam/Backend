# Tanseek P4 - API Documentation

**Base URL:** `http://localhost:5000/api/v1`

**Authentication:** JWT Bearer token in `Authorization` header

**Content-Type:** `application/json`

---

## Response Format

All responses follow a consistent envelope:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": { "field": "Validation error" },  // Optional, for validation errors
  "conflicts": [ ... ]  // Optional, for 409 conflict responses
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK |
| 201  | Created |
| 204  | No Content |
| 400  | Bad Request (validation error) |
| 401  | Unauthorized (missing/invalid/expired token) |
| 403  | Forbidden (insufficient role) |
| 404  | Not Found |
| 409  | Conflict (business rule violation) |
| 500  | Internal Server Error |

---

## Roles (from `account_role` enum)

- `SUPER_ADMIN` - Full access, no OTP required
- `ADMIN` - Administrative access
- `SCHEDULER` - Can create/edit/publish schedules
- `DEPARTMENT_COORDINATOR` - Department-scoped scheduling
- `LAB_MANAGER` - Room/lab management
- `LECTURER` - Can view schedules, submit availability
- `TA` - Teaching assistant
- `STUDENT` - Read-only access to published schedules

---

## Endpoints

### Health Check
```
GET /health
```
**Auth:** None

**Response:**
```json
{
  "success": true,
  "message": "API is running",
  "data": {
    "environment": "development",
    "database": { "connected": true, "result": { "ok": 1 } }
  }
}
```

---

### Authentication

#### Login
```
POST /auth/login
```
**Auth:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "deviceToken": "optional-trusted-device-token"
}
```

**Response (Super Admin - no OTP):**
```json
{
  "success": true,
  "data": {
    "requiresOtp": false,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "19",
      "email": "engramzy9@gmail.com",
      "fullName": "Super Admin",
      "role": "SUPER_ADMIN",
      "state": "ACTIVE",
      "homeDepartmentId": null
    }
  }
}
```

**Response (Regular user - OTP required):**
```json
{
  "success": true,
  "data": {
    "requiresOtp": true,
    "challengeId": "1",
    "expiresInSeconds": 600,
    "devCode": "123456"  // Only in development (DEV_EXPOSE_OTP=true)
  }
}
```

**Error Responses:**
- 400: `{ "success": false, "message": "Validation failed.", "errors": { "email": "Email is required." } }`
- 401: `{ "success": false, "message": "Invalid email or password." }`

---

#### Verify OTP
```
POST /auth/verify-otp
```
**Auth:** None

**Request:**
```json
{
  "email": "user@example.com",
  "challengeId": "1",
  "code": "123456",
  "deviceLabel": "My Laptop"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "20", "email": "...", "fullName": "...", "role": "SCHEDULER", "state": "ACTIVE", "homeDepartmentId": "1" },
    "deviceToken": "abc123..."  // Save this for trusted device login
  }
}
```

**Error Responses:**
- 401: `{ "success": false, "message": "Incorrect code." }`
- 401: `{ "success": false, "message": "This code has expired. Please log in again." }`

---

#### Get Current User
```
GET /auth/me
```
**Auth:** JWT Required (any role)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "19",
    "email": "engramzy9@gmail.com",
    "fullName": "Super Admin",
    "role": "SUPER_ADMIN",
    "state": "ACTIVE",
    "homeDepartmentId": null
  }
}
```

---

#### Admin Create Account (Super Admin / Admin only)
```
POST /auth/admin-create-account
```
**Auth:** JWT Required (SUPER_ADMIN, ADMIN)

**Request:**
```json
{
  "email": "new.user@example.com",
  "fullName": "New User",
  "role": "SCHEDULER",
  "homeDepartmentId": 1,
  "initialPassword": "SecurePass123!"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "21",
    "email": "new.user@example.com",
    "fullName": "New User",
    "role": "SCHEDULER",
    "state": "ACTIVE",
    "homeDepartmentId": "1"
  }
}
```

---

### Departments

#### List Departments
```
GET /departments
```
**Auth:** JWT Required (any role)

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "1", "code": "AI", "name": "Demo AI Department", "created_at": "2026-09-20T12:29:02.719Z" },
    { "id": "2", "code": "DS", "name": "Demo Data Science Department", "created_at": "2026-09-20T12:29:02.719Z" }
  ]
}
```

---

### Academic Terms

#### List Terms
```
GET /terms
```
**Auth:** JWT Required (any role)

#### Get Active Term
```
GET /terms/active
```
**Auth:** JWT Required (any role)

---

### Rooms

#### List Rooms
```
GET /rooms
```
**Auth:** JWT Required (any role)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "building": "Demo Building",
      "code": "LAB-01",
      "kind": "LAB",
      "capacity": 44,
      "accessible": false,
      "active": true,
      "managed_by": "3",
      "updated_at": "2026-09-20T12:29:02.719Z",
      "equipment": [{ "name": "COMPUTER_WITH_PYTHON", "quantity": 44 }]
    }
  ]
}
```

#### Get Room
```
GET /rooms/:id
```
**Auth:** JWT Required (any role)

#### Create Room (ADMIN, LAB_MANAGER)
```
POST /rooms
```

#### Update Room (ADMIN, LAB_MANAGER)
```
PATCH /rooms/:id
```

#### Add Room Closure (ADMIN, LAB_MANAGER)
```
POST /rooms/:id/closures
```

---

### Staff

#### List Staff
```
GET /staff
```
**Auth:** JWT Required (any role)

#### Get Staff Availability
```
GET /staff/:id/availability
```
**Auth:** JWT Required (any role)

---

### Courses

#### List Courses
```
GET /courses
```
**Auth:** JWT Required (any role)

#### Get Course
```
GET /courses/:id
```
**Auth:** JWT Required (any role)

#### Get Course Requirements
```
GET /courses/:id/requirements
```
**Auth:** JWT Required (any role)

#### Create Course (ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER)
```
POST /courses
```

---

### Sections

#### List Sections
```
GET /sections
```
**Auth:** JWT Required (any role)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "term_id": "1",
      "course_id": "1",
      "course_code": "AI301",
      "course_title": "Machine Learning",
      "code": "AI301-S1",
      "status": "ACTIVE",
      "groups": [
        { "id": "1", "name": "AI301-S1-G1", "student_count": 19 },
        { "id": "2", "name": "AI301-S1-G2", "student_count": 19 }
      ]
    }
  ]
}
```

#### Get Section
```
GET /sections/:id
```
**Auth:** JWT Required (any role)

#### Get Section Instructors
```
GET /sections/:id/instructors
```
**Auth:** JWT Required (any role)

#### Create Section (ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER)
```
POST /sections
```

---

### Student Groups

#### List Student Groups
```
GET /student-groups
```
**Auth:** JWT Required (any role)

#### Create Student Group (ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER)
```
POST /student-groups
```

---

### Time Slots

#### List Time Slots
```
GET /timeslots
```
**Auth:** JWT Required (any role)

---

### Schedule Versions

#### List Schedule Versions
```
GET /schedule-versions
```
**Auth:** JWT Required (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA)

#### Get Schedule Version
```
GET /schedule-versions/:id
```
**Auth:** JWT Required (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA)

#### Get Published Schedule Version
```
GET /schedule-versions/published
```
**Auth:** JWT Required (any role)

#### Validate Schedule Version
```
GET /schedule-versions/:id/validate
```
**Auth:** JWT Required (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA)

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "violations": [],
    "allocationCount": 3
  }
}
```

#### Create Schedule Version (ADMIN, SCHEDULER)
```
POST /schedule-versions
```
**Request:**
```json
{
  "termId": 1,
  "name": "Draft 2"
}
```

#### Publish Schedule Version (ADMIN, SCHEDULER)
```
POST /schedule-versions/:id/publish
```
**Auth:** JWT Required (ADMIN, SCHEDULER)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "term_id": "1",
    "version_number": 1,
    "name": "Draft 1",
    "state": "PUBLISHED",
    "created_by": "1",
    "published_by": "19",
    "published_at": "2026-09-20T13:07:39.344Z"
  }
}
```

---

### Allocations

#### List Allocations
```
GET /allocations?versionId=1
```
**Auth:** JWT Required (any role; STUDENT restricted to PUBLISHED versions)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "term_id": "1",
      "version_id": "1",
      "section_id": "1",
      "requirement_id": "1",
      "instructor_id": "4",
      "room_id": "1",
      "start_slot_id": "5",
      "ends_at": "11:00:00",
      "created_by": "1",
      "updated_by": null,
      "created_at": "2026-09-20T12:29:02.719Z",
      "updated_at": "2026-09-20T12:29:02.719Z",
      "section": { "code": "AI301-S1" },
      "room": { "code": "LAB-01" },
      "instructor": { "full_name": "Demo Instructor 01" }
    }
  ]
}
```

#### Check Conflicts (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR)
```
POST /allocations/check-conflicts
```
**Request:**
```json
{
  "versionId": 1,
  "sectionId": 1,
  "requirementId": 1,
  "instructorId": 4,
  "roomId": 1,
  "weekday": 7,
  "start": "09:00",
  "excludeAllocationId": null
}
```

**Response (Feasible):**
```json
{
  "success": true,
  "data": { "feasible": true, "conflicts": [] }
}
```

**Response (Conflicts):**
```json
{
  "success": true,
  "data": {
    "feasible": false,
    "conflicts": [
      { "type": "ROOM_CONFLICT", "message": "Room LAB-01 is already booked for this time slot." }
    ]
  }
}
```

---

#### Get Recommendations (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR)
```
POST /allocations/recommend
```
**Request:**
```json
{
  "versionId": 1,
  "sectionId": 1,
  "requirementId": 1,
  "instructorId": 4,
  "weekday": 7,
  "start": "09:00",
  "sameDayOnly": true,
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "room": "LAB-03",
      "roomId": "3",
      "weekday": 7,
      "start": "09:00",
      "end": "11:00",
      "score": 95,
      "reasons": [
        "Capacity matches student group closely",
        "Room type (LAB) matches requirement",
        "Required equipment available",
        "No scheduling conflict",
        "Keeps room utilization compact for this day"
      ]
    }
  ]
}
```

---

#### Create Allocation (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR)
```
POST /allocations
```
**Request:**
```json
{
  "versionId": 1,
  "sectionId": 1,
  "requirementId": 1,
  "instructorId": 4,
  "roomId": 1,
  "weekday": 7,
  "start": "09:00"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "4",
    "term_id": "1",
    "version_id": "1",
    "section_id": "1",
    "requirement_id": "1",
    "instructor_id": "4",
    "room_id": "1",
    "start_slot_id": "5",
    "ends_at": "11:00:00",
    "created_by": "19"
  }
}
```

**Error (409 Conflict):**
```json
{
  "success": false,
  "message": "Allocation conflicts detected",
  "conflicts": [
    { "type": "EQUIPMENT_SHORTAGE", "message": "requires 40 COMPUTER_WITH_PYTHON; LAB-02 has 30." }
  ]
}
```

---

#### Update Allocation (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR)
```
PATCH /allocations/:id
```

---

#### Delete Allocation (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR)
```
DELETE /allocations/:id
```

---

### Dashboard

#### Get Dashboard Summary
```
GET /dashboard/summary
```
**Auth:** JWT Required (ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA)

**Response:**
```json
{
  "success": true,
  "data": {
    "term": { "id": "1" },
    "version": { "id": "1", "name": "Draft 1", "state": "PUBLISHED", "versionNumber": 1 },
    "counts": {
      "totalRooms": 20,
      "activeRooms": 20,
      "totalAllocations": 3,
      "totalSections": 25,
      "totalStudentGroups": 50
    },
    "utilization": {
      "averagePct": 0.8,
      "byRoom": [
        { "roomId": "1", "roomCode": "LAB-01", "kind": "LAB", "capacity": 44, "bookedSlots": 2, "totalWeeklySlots": 20, "utilizationPct": 10 }
      ]
    },
    "conflicts": {
      "violatingAllocations": 0,
      "isPublishable": true
    }
  }
}
```

---

### Calendar / ICS Export

#### Export ICS Calendar
```
GET /calendar/export.ics
```
**Auth:** JWT Required (any role - serves only PUBLISHED schedule)

**Response:** `text/calendar` (RFC5545 .ics file with weekly RRULE)

---

## Conflict Types

The conflict engine detects these hard conflict types:

| Type | Description |
|------|-------------|
| `NO_WORKING_SLOT` | Requested time falls outside working hours/holidays |
| `INVALID_DURATION` | Slot length doesn't match requirement duration |
| `ROOM_TYPE_MISMATCH` | Room kind doesn't match required room kind |
| `ROOM_INACTIVE` | Room is marked inactive |
| `CAPACITY_SHORTAGE` | Room capacity < total students in section groups |
| `EQUIPMENT_SHORTAGE` | Room lacks required equipment quantity |
| `AVAILABILITY_NOT_CONFIRMED` | Instructor availability not confirmed or slot not available |
| `STAFF_UNAVAILABLE` | Instructor marked unavailable for this slot |
| `ROOM_CLOSED` | Room has a closure during this slot |
| `ROOM_CONFLICT` | Another allocation uses same room at same time |
| `STAFF_CONFLICT` | Instructor has another allocation at same time |
| `GROUP_CONFLICT` | Student group has another allocation at same time |

---

## Development Notes

### Environment Variables (.env)
```env
DATABASE_URL=postgres://user:pass@localhost:5432/tanseek
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=12h
FRONTEND_URL=http://localhost:5173
SUPER_ADMIN_EMAIL=engramzy9@gmail.com
SUPER_ADMIN_PASSWORD=your-password
DEV_EXPOSE_OTP=true
```

### Super Admin
- Email: `engramzy9@gmail.com` (fixed by schema)
- Password: Set via `SUPER_ADMIN_PASSWORD` in .env
- Never requires OTP
- Password verified via bcrypt

### Trusted Device Flow
1. First login from new device → returns `requiresOtp: true` + `challengeId` + `devCode` (dev only)
2. Call `/auth/verify-otp` with code → returns `deviceToken`
3. Store `deviceToken` in localStorage
4. Subsequent logins: send `X-Device-Token` header → skips OTP

### Running the Project

**Backend:**
```bash
cd backend
npm install
# Configure .env
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
npm run dev
```

**Frontend:**
```bash
cd tanseek-frontend/tanseek-frontend
npm install
# Create .env with VITE_API_BASE=http://localhost:5000/api/v1
npm run dev
```

**Tests:**
```bash
cd backend
npm test  # 21/21 unit tests pass
```