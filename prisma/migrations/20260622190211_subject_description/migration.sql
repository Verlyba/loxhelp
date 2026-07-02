-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "themeStyle" TEXT NOT NULL DEFAULT 'default',
    "classId" TEXT NOT NULL,
    CONSTRAINT "Subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("classId", "id", "name", "slug", "themeStyle") SELECT "classId", "id", "name", "slug", "themeStyle" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");
CREATE INDEX "Subject_classId_idx" ON "Subject"("classId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
