-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubjectFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "category" TEXT NOT NULL DEFAULT 'material',
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SubjectFile_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SubjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SubjectFile" ("category", "fileKey", "fileName", "fileSize", "id", "label", "mimeType", "order", "pageId") SELECT "category", "fileKey", "fileName", "fileSize", "id", "label", "mimeType", "order", "pageId" FROM "SubjectFile";
DROP TABLE "SubjectFile";
ALTER TABLE "new_SubjectFile" RENAME TO "SubjectFile";
CREATE INDEX "SubjectFile_pageId_idx" ON "SubjectFile"("pageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
