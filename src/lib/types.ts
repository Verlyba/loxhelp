// Client-safe shared types (DTOs returned by server functions in lib/data.ts
// and lib/actions.ts). No server-only imports here so any component can use them.
import type { Role, SubjectTheme } from "@/lib/roles";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  classId: string | null;
  mustChangePassword: boolean;
}

export type TaskStatus = "overdue" | "pending" | "submitted";

// Who submits an assignment: a single student, a pair, or a whole study group.
export const TARGET_TYPES = ["INDIVIDUAL", "PAIR", "GROUP"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const TARGET_LABEL: Record<TargetType, string> = {
  INDIVIDUAL: "Jednotlivec",
  PAIR: "Dvojice",
  GROUP: "Skupina",
};

export interface SubjectCard {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: SubjectTheme;
  className: string;
  schoolYear: string;
  assignmentCount: number;
  studentCount: number;
  classId?: string;
  imageUrl?: string | null;
}

export interface ActivityItem {
  assignmentId: string;
  assignmentTitle: string;
  subjectSlug: string;
  unitName: string; // "Dvojice 1" / student name / "L1"
  version: number;
  fileName: string;
  uploadedByName: string;
  uploadedAt: string; // ISO
}

export interface StudentTask {
  assignmentId: string;
  title: string;
  subjectName: string;
  subjectSlug: string;
  dueAt: string; // ISO
  status: TaskStatus;
  unitName: string;
  latestVersion: number | null;
}

export interface AssignmentOverview {
  id: string;
  title: string;
  description: string;
  dueAt: string; // ISO
  targetType: TargetType;
  isPublished: boolean;
  submittedUnits: number; // units with at least one version
  totalUnits: number;
  myStatus: TaskStatus | null; // set for students, null for staff
  myGrade: string | null;
  pageId?: string | null;
}

export interface ClassWithSubjects {
  id: string;
  name: string;
  schoolYear: string;
  isArchived: boolean;
  studentCount: number;
  subjects: {
    id: string;
    name: string;
    slug: string;
    theme: SubjectTheme;
    assignmentCount: number;
  }[];
  students: { id: string; name: string; email: string }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    authorName: string;
  }[];
}

export interface ClassesData {
  classes: ClassWithSubjects[];
  /** students without any class — available to add */
  withoutClass: { id: string; name: string; email: string }[];
  allSubjects: SubjectCard[];
}

export const PAGE_TEMPLATES = ["content", "assignments"] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

export interface SubjectFileItem {
  id: string;
  label: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  description: string;
  isPublished: boolean;
}

export interface SubjectPageNav {
  id: string;
  title: string;
  slug: string;
  template: PageTemplate;
}

export interface SubjectPageDetail extends SubjectPageNav {
  content: string;
  updatedAt: string; // ISO
  files: SubjectFileItem[];
  showAssignments: boolean;
  assignments?: AssignmentOverview[];
  blocks: PageBlockView[];
}

export const BLOCK_TYPES = ["TEXT", "MATERIALS", "ASSIGNMENTS"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** One block of a "content" template page's body — see PageBlock in schema.prisma. */
export interface PageBlockView {
  id: string;
  type: BlockType;
  content: string;
  order: number;
}

export interface AssignmentBrief {
  id: string;
  title: string;
  dueAt: string; // ISO
  status: TaskStatus;
  targetType: TargetType;
}

/** Data for the two static panels at the top of a course (student view). */
export interface StudentSubjectPanel {
  current: AssignmentBrief | null; // earliest-due published assignment still missing
  missing: AssignmentBrief[]; // all missing incl. current
  submittedCount: number;
  publishedCount: number;
  recentGrades: { assignmentTitle: string; value: string }[];
  myStudyGroup: string | null;
  myPair: { name: string; partnerNames: string[] } | null;
}

/** Data for the two static panels at the top of a course (staff view). */
export interface StaffSubjectPanel {
  unpublished: { id: string; title: string; dueAt: string; targetType: TargetType }[];
  published: {
    id: string;
    title: string;
    dueAt: string;
    submittedUnits: number;
    totalUnits: number;
  }[];
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string; // ISO
}

export interface SubjectDetail extends SubjectCard {
  assignments: AssignmentOverview[];
  pages: SubjectPageNav[];
  studentPanel: StudentSubjectPanel | null; // set for students
  staffPanel: StaffSubjectPanel | null; // set for staff
  latestAnnouncement: { id: string; title: string; createdAt: string } | null;
  announcementCount: number;
  /** announcements posted since this student last opened the news tab (0 for staff) */
  unreadAnnouncementCount: number;
  /** page currently marked as the taught topic ("aktivní látka") */
  activePageId: string | null;
}

/** All downloadable materials of a course on one page, grouped by course page. */
export interface SubjectMaterialsData {
  subjectName: string;
  subjectSlug: string;
  theme: SubjectTheme;
  pages: { id: string; title: string; slug: string; files: SubjectFileItem[] }[];
}

/** Currently taught topic of one course, shown on the student dashboard. */
export interface ActiveTopic {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  theme: SubjectTheme;
  pageTitle: string;
  pageSlug: string;
}

/* ---------- audit log (PRD §5C) ---------- */

export interface AuditEntryView {
  id: string;
  action: string; // GRADE_SET | GRADE_CHANGE | GRADE_DELETE | FEEDBACK_CHANGE | SUBMISSION_LOCK | …
  actorName: string;
  targetName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string; // ISO
}

/* ---------- pair activity (skokový graf: nahráno / nenahráno po týdnech) ---------- */

/** Whether at least one upload landed in that week. `label` is the Monday date, cs-CZ short. */
export interface WeekBucket {
  label: string; // "1.1."
  weekStart: string; // ISO
  count: number; // >0 renders as "uploaded"; the chart never shows the number itself
}

/** One line of the step chart: a person's weekly upload presence. */
export interface PairActivityLane {
  name: string;
  weeks: WeekBucket[];
}

/** Per-course "did each of us upload this week" — this student vs their pair partner. */
export interface PairWeeklyComparison {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  theme: SubjectTheme;
  pairName: string;
  me: PairActivityLane;
  partner: PairActivityLane | null; // null if no partner assigned yet
}

/* ---------- globální karta žáka (napříč kurzy) ---------- */

export interface StudentProfileData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    classId: string | null;
    className: string | null;
    createdAt: string; // ISO
  };
  subjects: {
    id: string;
    name: string;
    slug: string;
    theme: SubjectTheme;
    studyGroup: string | null;
    pair: string | null;
  }[];
  stats: {
    totalUploads: number;
    gradedCount: number;
    avgGrade: string | null;
  };
  classes: { id: string; name: string; schoolYear: string; isArchived: boolean }[];
  /** one weekly me-vs-partner comparison per course where the student is paired */
  pairCharts: PairWeeklyComparison[];
  moodleResults: StudentMoodleResultView[];
  /** every published assignment across all enrolled courses, newest deadline first */
  assignments: StudentAssignmentRow[];
}

/** One assignment's submission/grade status for a student, with course context —
 * the cross-course counterpart of StudentCardRow (which is scoped to one course). */
export interface StudentAssignmentRow {
  assignmentId: string;
  subjectName: string;
  subjectSlug: string;
  title: string;
  dueAt: string; // ISO
  targetType: TargetType;
  status: TaskStatus | "none";
  submittedAt: string | null;
  grade: string | null;
  feedback: string | null;
}

/** One imported Moodle test attempt, as shown on the karta žáka. */
export interface StudentMoodleResultView {
  testTitle: string;
  subjectName: string;
  subjectSlug: string;
  rawScore: number;
  maxPoints: number;
  grade: string;
  attemptAt: string | null; // ISO
}

/* ---------- karta žáka (Moodle "user report") ---------- */

export interface StudentCardRow {
  assignmentId: string;
  title: string;
  dueAt: string; // ISO
  targetType: TargetType;
  status: TaskStatus | "none";
  submittedAt: string | null;
  versions: number; // unit total
  myUploads: number; // uploaded personally
  onTime: boolean | null; // null = not submitted
  grade: string | null;
  feedback: string | null;
}

export interface StudentCardData {
  student: {
    id: string;
    name: string;
    email: string;
    className: string | null;
    firstName: string;
    lastName: string;
    role: string;
    classId: string | null;
  };
  subjectName: string;
  subjectSlug: string;
  studyGroup: string | null;
  pair: { name: string; partnerNames: string[] } | null;
  stats: {
    submitted: number;
    total: number;
    avgGrade: string | null; // formatted, e.g. "1,4"
    onTimeRate: number | null; // 0-100 %
    totalUploads: number;
  };
  rows: StudentCardRow[];
  recentUploads: { fileName: string; assignmentTitle: string; uploadedAt: string }[];
  classes: { id: string; name: string }[];
}

export interface VersionItem {
  id: string;
  version: number;
  fileName: string;
  fileSize: number;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: string; // ISO
  note: string | null;
}

/** One submission unit of an assignment (student / pair / study group). */
/** One weekly "5" auto-accrued for time-management (§ late penalty). */
export interface LatePenaltyView {
  weekIndex: number;
  value: string;
  weight: number;
}

export interface UnitView {
  key: string; // unitKey: "u:<id>" | "p:<id>" | "g:<id>"
  name: string; // student name / "Dvojice 1 (L1)" / "L1"
  studyGroupName: string | null;
  members: { id: string; name: string }[];
  versions: VersionItem[]; // newest first
  submittedAt: string | null; // first version time
  grade: string | null; // shared for PAIR/GROUP; the student's for INDIVIDUAL
  feedback: string | null;
  locked: boolean;
  extension: string | null; // ISO
  latePenalties: LatePenaltyView[];
}

export interface AssignmentConsentView {
  userId: string;
  userName: string;
  acceptedText: string;
  variant: string | null;
  acceptedAt: string; // ISO string
}

export interface AssignmentDetail {
  id: string;
  title: string;
  description: string;
  dueAt: string; // ISO
  subjectName: string;
  subjectSlug: string;
  theme: SubjectTheme;
  targetType: TargetType;
  isPublished: boolean;
  canUpload: boolean;
  myUnitKey: string | null;
  units: UnitView[]; // staff: all units; student: only their own
  requiresConsent: boolean;
  consentText: string;
  myConsent: {
    acceptedText: string;
    variant: string | null;
    acceptedAt: string; // ISO string
  } | null;
  consents?: AssignmentConsentView[];
  pageId?: string | null;
  /** Weekly upload presence for me vs my pair partner(s), scoped to just this
   * assignment's submissions — only set for PAIR-target assignments viewed by
   * a paired student. */
  pairActivity: { pairName: string; me: PairActivityLane; partner: PairActivityLane | null } | null;
}

/* ---------- study groups & pairs management ---------- */

/** One PAIR-target assignment's grades + weekly upload presence for a pair —
 * scoped to that single assignment's submissions, not the whole course. */
export interface PairAssignmentActivity {
  assignmentId: string;
  title: string;
  dueAt: string;
  grades: { memberId: string; memberName: string; grade: string | null }[];
  activity: PairActivityLane[];
}

export interface PairView {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  assignments: PairAssignmentActivity[];
}

export interface StudyGroupView {
  id: string;
  name: string;
  members: { id: string; name: string; pairName: string | null }[];
  pairs: PairView[];
}

export interface SubjectGroupsData {
  subjectId: string;
  subjectName: string;
  studyGroups: StudyGroupView[];
  /** enrolled in the subject but not in any study group yet */
  unassigned: { id: string; name: string }[];
  /** students of the subject's class not enrolled in the subject */
  notEnrolled: { id: string; name: string }[];
}

/* ---------- class overview (per course) ---------- */

export interface OverviewCell {
  status: TaskStatus | "none";
  submittedAt: string | null;
  versions: number;
  myUploads: number; // versions uploaded by this student personally
  grade: string | null;
  feedback: string | null;
  locked: boolean;
  extension: string | null; // ISO
  versionsList: VersionItem[];
  members: { id: string; name: string }[];
  latePenalties: LatePenaltyView[];
}

export interface ClassOverviewData {
  subjectName: string;
  assignments: { id: string; title: string; dueAt: string; targetType: TargetType }[];
  rows: {
    studentId: string;
    name: string;
    studyGroup: string | null;
    pair: string | null;
    cells: Record<string, OverviewCell>; // by assignmentId
  }[];
}

/* ---------- odevzdávárna (submission hub) ---------- */

export interface HubItem {
  assignmentId: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
  targetType: TargetType;
  grade: string | null;
  subjectSlug: string;
}

export interface HubCourse {
  subjectId: string;
  name: string;
  slug: string;
  theme: SubjectTheme;
  missing: HubItem[];
  done: HubItem[];
}

/* ---------- global directory search (staff) ---------- */

export type SearchResultKind = "student" | "subject";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface StaffDashboard {
  kind: "staff";
  stats: { subjects: number; activeClasses: number; assignments: number; openSubmissions: number };
  subjects: SubjectCard[];
  recentUploads: ActivityItem[];
}

export interface StudentDashboard {
  kind: "student";
  subjects: SubjectCard[];
  activeTopics: ActiveTopic[];
  classNotifications: {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    authorName: string;
  }[];
}

export type DashboardData = StaffDashboard | StudentDashboard;

export interface StudentPanelData {
  tasks: StudentTask[];
}

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: Role;
  classId: string | null;
  className: string | null;
}

export interface AdminClassRow {
  id: string;
  name: string;
  schoolYear: string;
  isArchived: boolean;
  subjectCount: number;
  studentCount: number;
}

export interface AdminData {
  users: AdminUserRow[];
  classes: AdminClassRow[];
  subjects: SubjectCard[];
  auditLogs: AuditEntryView[];
}

/* ---------- grading automation: Moodle import + late penalty (per course) ---------- */

export interface GradingSettingsView {
  grade1Min: number;
  grade2Min: number;
  grade3Min: number;
  grade4Min: number;
  latePenaltyEnabled: boolean;
  latePenaltyWeight: number;
}

export interface MoodleTestSummary {
  id: string;
  title: string;
  sourceFileName: string;
  createdAt: string; // ISO
  resultCount: number;
  matchedCount: number;
  avgGrade: string | null;
}

export interface MoodleTestResultRow {
  id: string;
  userId: string | null;
  matchedName: string;
  matchedEmail: string | null;
  rawScore: number;
  percentage: number;
  grade: string;
  attemptAt: string | null; // ISO
  durationSeconds: number | null;
}

export interface MoodleTestDetail {
  id: string;
  title: string;
  subjectName: string;
  subjectSlug: string;
  maxPoints: number;
  results: MoodleTestResultRow[];
  enrolledStudents: { id: string; name: string }[]; // for fixing unmatched rows
}
