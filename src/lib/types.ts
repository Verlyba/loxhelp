// Client-safe shared types (DTOs returned by server functions in lib/data.ts
// and lib/actions.ts). No server-only imports here so any component can use them.
import type { Role, SubjectTheme } from "@/lib/roles";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export type TaskStatus = "overdue" | "pending" | "submitted";

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
}

export interface ActivityItem {
  assignmentId: string;
  assignmentTitle: string;
  subjectSlug: string;
  groupName: string;
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
  groupName: string;
  latestVersion: number | null;
}

export interface AssignmentOverview {
  id: string;
  title: string;
  description: string;
  dueAt: string; // ISO
  groupCount: number;
  submittedCount: number;
  myStatus: TaskStatus | null; // set for students, null for staff
}

export interface ClassWithSubjects {
  id: string;
  name: string;
  schoolYear: string;
  isArchived: boolean;
  studentCount: number;
  subjects: { id: string; name: string; slug: string; theme: SubjectTheme }[];
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
}

export interface SubjectDetail extends SubjectCard {
  assignments: AssignmentOverview[];
  pages: SubjectPageNav[];
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

export interface GroupView {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  versions: VersionItem[]; // newest first
}

export interface AssignmentDetail {
  id: string;
  title: string;
  description: string;
  dueAt: string; // ISO
  subjectName: string;
  subjectSlug: string;
  theme: SubjectTheme;
  canUpload: boolean;
  myGroupId: string | null;
  groups: GroupView[]; // staff: all; student: only their group
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
  tasks: StudentTask[];
  recent: ActivityItem[];
}

export type DashboardData = StaffDashboard | StudentDashboard;

export interface StudentPanelData {
  tasks: StudentTask[];
  recent: ActivityItem[];
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
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
}

export interface StudentOption {
  id: string;
  name: string;
  inGroup: boolean; // already assigned to a group in this assignment
}
