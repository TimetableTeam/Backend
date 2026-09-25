const createSectionEnrollment = asyncHandler(async (req, res) => {
  await ensureCompatTables();

  const studentId = num(req.body.studentId ?? req.body.student_id);
  const termId = await resolveFrontendTermId(
    req.body.termId ?? req.body.term_id
  );

  let courseId = num(req.body.courseId ?? req.body.course_id);
  let sectionId = num(req.body.sectionId ?? req.body.section_id);

  if (!courseId && req.body.course_code) {
    courseId = (
      await query(
        `SELECT id
         FROM courses
         WHERE code = $1
         LIMIT 1`,
        [String(req.body.course_code).trim()]
      )
    ).rows[0]?.id || null;
  }

  if (!sectionId && req.body.section_code) {
    sectionId = (
      await query(
        `SELECT id
         FROM sections
         WHERE code = $1
           AND ($2::bigint IS NULL OR term_id = $2::bigint)
         LIMIT 1`,
        [
          String(req.body.section_code).trim(),
          termId,
        ]
      )
    ).rows[0]?.id || null;
  }

  const component = normalizeSessionKind(
    req.body.component ?? req.body.section_kind
  );

  if (!studentId || !termId || !courseId || !sectionId) {
    throw ApiError.badRequest(
      'student, course, section and term are required.'
    );
  }

  // Check selected section
  const section = (
    await query(
      `SELECT
          s.id,
          s.course_id,
          s.term_id,
          c.department_id,
          sr.kind AS requirement_kind
       FROM sections s
       JOIN courses c ON c.id = s.course_id
       LEFT JOIN session_requirements sr
         ON sr.id = s.requirement_id
       WHERE s.id = $1::bigint`,
      [sectionId]
    )
  ).rows[0];

  if (!section) {
    throw ApiError.notFound('Section not found.');
  }

  if (Number(section.course_id) !== Number(courseId)) {
    throw ApiError.badRequest(
      'Selected section belongs to another course.'
    );
  }

  if (Number(section.term_id) !== Number(termId)) {
    throw ApiError.badRequest(
      'Selected section belongs to another term.'
    );
  }

  if (
    section.requirement_kind &&
    normalizeSessionKind(section.requirement_kind) !== component
  ) {
    throw ApiError.badRequest(
      'Selected section does not match the requested component.'
    );
  }

  if (
    req.user.role === ROLES.DEPARTMENT_COORDINATOR &&
    req.user.homeDepartmentId &&
    Number(section.department_id) !== Number(req.user.homeDepartmentId)
  ) {
    throw ApiError.forbidden('DEPARTMENT_SCOPE_VIOLATION');
  }

  // Check that the student is registered in the course
  const reg = (
    await query(
      `SELECT *
       FROM student_course_registrations
       WHERE student_id = $1::bigint
         AND term_id = $2::bigint
         AND course_id = $3::bigint
         AND state = 'REGISTERED'`,
      [
        studentId,
        termId,
        courseId,
      ]
    )
  ).rows[0];

  if (!reg) {
    throw ApiError.conflict(
      'Register the course before assigning a section.'
    );
  }

  // Create / update section enrollment
  const r = (
    await query(
      `INSERT INTO student_section_enrollments
        (
          registration_id,
          term_id,
          course_id,
          section_kind,
          section_id,
          state,
          assigned_by,
          assigned_at
        )
       VALUES
        (
          $1,
          $2::bigint,
          $3::bigint,
          $4,
          $5::bigint,
          'ACTIVE',
          $6,
          now()
        )
       ON CONFLICT (registration_id, section_kind)
       DO UPDATE SET
          section_id = EXCLUDED.section_id,
          state = 'ACTIVE',
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = now(),
          ended_at = NULL
       RETURNING *`,
      [
        reg.id,
        termId,
        courseId,
        component,
        sectionId,
        req.user.id,
      ]
    )
  ).rows[0];

  const c = (
    await query(
      `SELECT code
       FROM courses
       WHERE id = $1::bigint`,
      [courseId]
    )
  ).rows[0];

  const sec = (
    await query(
      `SELECT code
       FROM sections
       WHERE id = $1::bigint`,
      [sectionId]
    )
  ).rows[0];

  return created(res, {
    ...r,
    studentId,
    termId: r.term_id,
    courseId: r.course_id,
    sectionId: r.section_id,
    component: r.section_kind,
    course_code: c?.code,
    section_code: sec?.code,
    status: 'ACTIVE',
  });
});