-- CreateTable
CREATE TABLE "SubjectFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "category" TEXT NOT NULL DEFAULT 'material',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SubjectFile_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SubjectPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SubjectFile_pageId_idx" ON "SubjectFile"("pageId");
