/*
  Warnings:

  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `groupId` on the `Submission` table. All the data in the column will be lost.
  - Added the required column `assignmentId` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitKey` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Group_assignmentId_idx";

-- DropIndex
DROP INDEX "GroupMember_groupId_userId_key";

-- DropIndex
DROP INDEX "GroupMember_userId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Group";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GroupMember";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "StudyGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    CONSTRAINT "StudyGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "StudyGroupMember_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "studyGroupId" TEXT NOT NULL,
    CONSTRAINT "Pair_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PairMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pairId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "PairMember_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PairMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT,
    "note" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "extension" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Grade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "subjectId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("createdAt", "description", "dueDate", "id", "subjectId", "title") SELECT "createdAt", "description", "dueDate", "id", "subjectId", "title" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_subjectId_idx" ON "Assignment"("subjectId");
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "unitKey" TEXT NOT NULL,
    "userId" TEXT,
    "pairId" TEXT,
    "studyGroupId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("createdAt", "fileKey", "fileName", "fileSize", "id", "mimeType", "note", "uploadedById", "version") SELECT "createdAt", "fileKey", "fileName", "fileSize", "id", "mimeType", "note", "uploadedById", "version" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");
CREATE INDEX "Submission_unitKey_idx" ON "Submission"("unitKey");
CREATE UNIQUE INDEX "Submission_assignmentId_unitKey_version_key" ON "Submission"("assignmentId", "unitKey", "version");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "classId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "lastName", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "lastName", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StudyGroup_subjectId_idx" ON "StudyGroup"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroup_subjectId_name_key" ON "StudyGroup"("subjectId", "name");

-- CreateIndex
CREATE INDEX "StudyGroupMember_userId_idx" ON "StudyGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroupMember_studyGroupId_userId_key" ON "StudyGroupMember"("studyGroupId", "userId");

-- CreateIndex
CREATE INDEX "Pair_studyGroupId_idx" ON "Pair"("studyGroupId");

-- CreateIndex
CREATE INDEX "PairMember_userId_idx" ON "PairMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PairMember_pairId_userId_key" ON "PairMember"("pairId", "userId");

-- CreateIndex
CREATE INDEX "Grade_userId_idx" ON "Grade"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_assignmentId_userId_key" ON "Grade"("assignmentId", "userId");
