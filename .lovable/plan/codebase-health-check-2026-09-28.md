# Codebase health check

Short answer: it is not messy in a dangerous way. The structure is sound (pages, hooks, shared lib, shadcn UI, one Supabase client, RLS-scoped data). What has accumulated is the normal debris of fast iteration: a few oversized page files, some duplicated backend logic, loose typing, and hardcoded styling in a couple of pages.

## What is healthy

- Clear folder structure: `src/pages`, `src/components/settings`, `src/hooks`, `src/lib`, `supabase/functions`.
- Shared helpers already exist and are used: `lib/attendance-utils.ts`, `lib/student-utils.ts`, `lib/csv-parse.ts`, `lib/csv-date.ts`, `functions/_shared/sender.ts`.
- Routing is flat and readable; no duplicate routes remain.
- Almost no leftover debug logging in the frontend.
- No TODO/FIXME rot anywhere in the codebase.

## What is actually messy

1. Oversized page files doing fetching, mutation, dialogs and CSV import in one component:
   - `src/pages/OwnerStudents.tsx` (750 lines)
   - `src/pages/Onboarding.tsx` (654 lines)
   - `src/pages/ClassRegister.tsx` (513 lines)
   - `src/pages/StudentProfile.tsx` (485 lines)
2. Duplicated school deletion logic in two edge functions: `delete-school` (owner-triggered, also deletes auth users) and `admin-delete-school` (admin panel, keeps auth users). They diverge on which tables they clean up.
3. Loose typing: roughly 35 uses of `any`, concentrated in `OwnerActivity`, `RetentionDashboard`, `OwnerClassDetail`, `AcceptInvite`.
4. Hardcoded colour values instead of design tokens: `ParentNote.tsx` (27 instances) and `Admin.tsx` (8). Everywhere else uses tokens correctly.
5. Data access is inline in components rather than in query hooks; only `useStudentWithDetails` and `useRecentNotes` are extracted, so similar student/class queries are re-written per page.
6. Leftover `console.log` in `create-school` and `check-attendance-webhooks`.
7. Effectively no test coverage: `src/test/example.test.ts` is a placeholder.

## Suggested cleanup, in order of value

**Phase 1 — low risk, no behaviour change**
- Move the colour literals in `ParentNote.tsx` and `Admin.tsx` onto design tokens.
- Remove leftover `console.log` calls in the two edge functions.
- Replace the easy `any` types with generated Supabase row types.

**Phase 2 — structural, still behaviour-preserving**
- Split `OwnerStudents.tsx`: extract the CSV import panel and the add-student form into `src/components/students/`.
- Split `Onboarding.tsx`: extract the CSV import step into a shared component reused by OwnerStudents.
- Extract `ClassRegister.tsx` student add/remove dialogs into their own components.
- Move repeated student/class queries into hooks under `src/hooks/`.

**Phase 3 — backend tidy**
- Consolidate the two school-deletion functions onto one shared cascade helper in `functions/_shared/`, with a flag for whether auth users are removed.

**Phase 4 — safety net**
- Add real unit tests for `attendance-utils`, `student-utils`, `csv-parse` and `csv-date` — pure functions, high value, no mocking needed.

## Notes

Nothing here is blocking production. Phase 1 is cosmetic and quick; Phase 2 is where the real maintainability gain sits. Each phase can be done independently.
