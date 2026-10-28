# **MedEx Clinic Queue**

A queue and token system for Bodhi Family Clinic in Kathmandu. Reception checks patients in and gives each one a token. Doctors call the next patient. A waiting-room screen shows who is being called. Patients can see roughly how long they will wait.

The project has two parts:

- **`backend/`**: Express, TypeScript, Prisma, and PostgreSQL. It holds all the queue rules.
- **`frontend/`**: React, TypeScript, Vite, and Tailwind. It has three screens: reception, doctor, and waiting-room display.

## **Prerequisites**

- Node.js 20 or newer
- PostgreSQL 16, either locally or in Docker

## **How to run it**
### 1. Create the databases

Create two databases, one for development and one for the automated tests:

In PowerShell:

```powershell
$env:PGPASSWORD = "1234"
psql -U postgres -h localhost -c 'CREATE DATABASE "medex-clinic";'
psql -U postgres -h localhost -c 'CREATE DATABASE "medex-clinic-test";'
```

### 2. Backend

```powershell
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
```

### 3. Frontend

```powershell
cd frontend
npm install
```

## Run the app

Open two terminals.

**Terminal 1, backend:**

```powershell
cd backend
npm run dev
```

**Terminal 2, frontend:**

```powershell
cd frontend
npm run dev
```

Then open:

- http://localhost:5173/reception: check in patients
- http://localhost:5173/doctor: call, finish, or mark no-show
- http://localhost:5173/display: waiting-room screen

Start the backend first. The frontend shows "server unavailable" until it responds.

## Run the tests

Use a new terminal, so the test settings don't affect the dev server:

```powershell
cd backend
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASS@localhost:5432/medex-clinic-test?schema=public"
npx prisma migrate deploy
$env:TEST_DATABASE_URL = "postgresql://postgres:YOUR_PASS@localhost:5432/medex-clinic-test?schema=public"
npm test
```

## **How the queue works**

All times use the clinic's time zone, Asia/Kathmandu (UTC+05:45).

### **Check-in**

Each patient has a name, an age from 0 to 120, and a kind:

- **Emergency**: seen first. Set `emergency: true`. An appointment time isn't needed.
- **Appointment**: has an appointment time. If the patient checks in more than 15 minutes after that time, they become a walk-in. Exactly 15 minutes late is still on time.
- **Walk-in**: no appointment time.

### **Tokens and queue prefixes**

The first letter of a token shows the queue the patient was placed in.

| Queue | Prefix | Example |
|---|---|---|
| Emergency | `E` | `E-001` |
| Appointment | `A` | `A-001` |
| Walk-in, or a late appointment | `W` | `W-001` |

Each prefix has its own counter. Counters restart at 001 every clinic day, at midnight in Kathmandu. Token numbers come from an atomic database upsert, so two simultaneous check-ins can't receive the same number.

A token never changes. A requeued no-show keeps the token they were given, even though their current queue may now be walk-in.

### **Call next**

When a doctor presses Call next, the next patient is chosen in this order:

1. **Emergencies**, by check-in time.
2. **Due appointments**: appointments no later than 10 minutes from now, ordered by appointment time and then check-in time.
3. **Walk-ins**: patients aged 65 or over first, then everyone else. Each group is ordered by check-in time.
4. **Early appointments**: if nobody else is waiting, the appointment with the earliest time, even if it isn't due yet.

### **Fairness**

Walk-ins shouldn't wait forever behind appointments. Look at the last three calls that weren't emergencies, counting both doctors. If all three were due appointments and a walk-in is waiting, the next call is a walk-in.

Emergencies are left out of this window on purpose. Otherwise an emergency could hide a run of due appointments and stop the walk-in from being called.

### **No-show**

A doctor can mark the patient they're seeing as a no-show.

- **First no-show**: the patient returns to the queue as a walk-in and keeps their token. Their check-in time becomes the time of the no-show, so they go to the back of the walk-in queue.
- **Second no-show**: the patient leaves the queue.

### **Queue order and wait estimates**

The waiting list shows patients in the order a doctor would call them if they kept pressing Call next right now. The list is produced by running the same selection rules, so it always matches what Call next would do.

Each estimate is:

```
estimatedWaitMinutes = floor(position / number of doctors) × 12
```

Positions start at 0. With two doctors, positions 0 and 1 show "Next". This is a simple estimate. It assumes both doctors keep working at the average pace and doesn't account for future check-ins.

### **Doctor rules**

- A doctor sees one patient at a time.
- A doctor must press Done or No-show before calling the next patient.
- Two doctors can never receive the same patient, even if they press at the same moment.

## **API**

All endpoints return JSON. Errors include an `error` message, and validation errors also include a `fields` object.

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/api/check-ins` | Check a patient in | `201` with token |
| `POST` | `/api/doctors/:id/call-next` | Call the next patient | `200` with patient, or `null` |
| `POST` | `/api/doctors/:id/done` | Finish the current patient | `200` |
| `POST` | `/api/doctors/:id/no-show` | Mark the current patient as a no-show | `200` with outcome |
| `GET` | `/api/queue` | Current queue with wait estimates | `200` |

### **Check-in request**

```json
{
  "name": "Ram",
  "age": 45,
  "kind": "appointment",
  "appointmentTime": "2026-11-02T09:00:00+05:45"
}
```

`emergency` is optional and defaults to `false`. `appointmentTime` is required for non-emergency appointments and not allowed for walk-ins. It must include an offset.

### **Queue response**

Each waiting patient includes `position`, `token`, `name`, `age`, `checkedInAt`, `appointmentTime`, and `estimatedWaitMinutes`. Each patient being seen includes `doctorId`, `token`, `name`, `age`, `checkedInAt`, and `appointmentTime`.

### **Error statuses**

| Status | When |
|---|---|
| `400` | Invalid input, malformed JSON, or a malformed `X-Now` header |
| `404` | Unknown doctor |
| `409` | The action doesn't make sense, such as Call next while already seeing a patient, or Done with no patient |
| `500` | Unexpected server error |

### **Testing with a fixed time**

Queue rules depend on the current time. In non-production environments, send an `X-Now` header to set the time of a request:

```bash
curl -H "X-Now: 2026-11-02T09:30:00+05:45" http://localhost:3000/api/queue
```

The header is ignored when `NODE_ENV=production`.

## **Testing**

| File | Needs database | What it checks |
|---|---|---|
| `tests/queue-rules.test.ts` | No | Late check-ins, call order, the 10-minute due window, seniors, early calls, fairness, the no-show outcome, the 09:26 queue snapshot, and wait estimates |
| `tests/queue-behaviour.test.ts` | Yes | Fairness ignoring emergencies, requeueing and leaving on no-show, and concurrent doctor presses |
| `tests/clinic-replay.test.ts` | Yes | Replays every event in `data/clinic.json` through the API and compares tokens, calls, and queue snapshots with the expected values |

The replay test is the most complete check. It runs the whole system (HTTP, validation, database, and rules) against the example from the task. Each example starts from an empty day, so the tests don't depend on order.

Some database tests take several seconds on the first run, because Prisma opens its connection pool. The replay test has a 30-second timeout for this reason.

## **Design decisions**

- **Rules are pure functions.** `selectNextPatient`, `noShowOutcome`, `simulateQueue`, and `resolveQueueKind` take data and return a result. They don't touch the database or the clock, so they can be tested in milliseconds.
- **The queue view uses the same selection code as Call next.** `simulateQueue` runs `selectNextPatient` repeatedly, so reception's order and a doctor's next patient can't disagree.
- **One layer per concern.** Routes handle HTTP, Zod validates input, services hold the workflow, repositories talk to the database, and domain functions hold the rules.
- **Classes only for repositories and services.** Everything else is a plain function.
- **Repositories sit behind interfaces.** Services depend on `QueueRepository` and `CheckInRepository`, not on Prisma.
- **One advisory lock for every queue write.** Two doctors can't be given the same patient. Reads run in a Repeatable Read transaction, so the queue view never mixes old and new state.
- **Time is injected.** Each request gets its time from `req.now`. Tests set it with `X-Now`, and the real clock is used otherwise.
- **The data file drives the seed and the replay.** Doctors and the average consultation time come from `clinic.json`, so changing the file changes the app without code changes.
- **Prisma with two raw SQL statements.** The token counter and the advisory lock need atomic SQL that Prisma's query API doesn't express. Both are commented in the code.
- **Polling, not WebSockets.** The frontend refreshes every 2 to 3 seconds, which is simple and reliable at clinic scale.
- **The waiting-room display shows tokens only.** Patient names, ages, and appointment times stay off the public screen.
- **Errors share one shape.** Every error becomes `{ error, fields? }` with the right status code.

## **Concurrency**

Several reception staff and doctors can act at the same time. Four measures keep the queue consistent:

Atomic token numbers. Each token comes from one database statement that increments a counter for the day and letter. Two simultaneous check-ins can’t receive the same number. The (day, token) unique constraint blocks any duplicate that gets through.
Locked queue changes. Call next, Done, and No-show run in a transaction that takes a Postgres advisory lock. Only one queue change runs at a time, so two doctors can’t receive the same patient.
One patient per doctor. A doctor must press Done or No-show before calling the next patient. A second Call next returns 409 Conflict.
Consistent queue reads. GET /api/queue reads everything in one Repeatable Read transaction, so the screen never mixes old and new states.


## **AI tools**

AI tools were used during development to plan the structure and algorithm logic and check the rules against the example and in debugging.

## **What I would improve with more time**

- **Authentication.** Reception and doctor actions have no login. Doctor screens should belong to a signed-in doctor, and reception should require a staff login.
- **Real-time updates.** Replace polling with Server-Sent Events, so screens update as soon as something changes.
- **Doctors from the API.** Add `GET /api/doctors`, so the frontend stops hardcoding `D1` and `D2`.
- **End-of-day handling.** The day rolls over at midnight, but there is no way to close a day or review its calls. An end-of-day summary would help.
- **Better wait estimates.** The estimate uses a fixed 12 minutes. It could use the average of today's completed consultations.
- **Reports.** `call_log` already records every call, so it could support reports on waiting times and no-show rates.
- **A patient screen.** Patients could check their token and estimate from a phone.
- **More tests.** Add replay examples for edge cases, such as a doctor who never presses Done, and add frontend component tests and an end-to-end browser test.
- **Deployment.** Add a backend Dockerfile, a production frontend build, and a `docker-compose.yml` that starts the backend, frontend, and PostgreSQL together.
- **Time zone config.** The fixed offset is correct for Kathmandu, but a clinic elsewhere would need the offset read from configuration.