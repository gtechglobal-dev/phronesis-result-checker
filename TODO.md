# TODO - Subject Teacher Password Visibility

- [x] Backend: add GET endpoint `/auth/subject-teacher-password` (EXAM_OFFICER only) returning the stored bcrypt hash for SUBJECT_TEACHER users.
- [x] Backend: wire new route in `backend/src/routes/auth.js`.
- [x] Frontend: add `authAPI.getSubjectTeacherPassword()` in `frontend/src/services/api.js`.
- [x] Frontend: update `frontend/src/pages/dashboard/ExamOfficerDashboard.jsx` to fetch current hash and display it in a masked field with an eye icon toggle.
- [x] Backend: fix login to validate SUBJECT_TEACHER against stored DB hash (not env variable).
- [x] Backend: fix `createTeacher` for SUBJECT_TEACHER role — copy shared password from existing DB user or config.
- [x] Backend: add `SubjectTeacherConfig` model to persist shared password hash even when no subject teacher users exist yet.
- [x] Backend: `updateSubjectTeacherPassword` now saves hash to `SubjectTeacherConfig` (in addition to updating users).
- [x] Backend: `getSubjectTeacherPasswordHash` now falls back to `SubjectTeacherConfig` if no subject teacher users exist.
- [x] Frontend: add Open Graph meta tags to `index.html` for social media previews (title, description, image, twitter card).
- [ ] Quick verification: ensure existing PUT update flow still works.
