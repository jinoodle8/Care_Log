-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ELDER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "ScheduleSlot" AS ENUM ('MORNING', 'NOON', 'EVENING');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('TAKEN', 'UNCERTAIN', 'MISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "slot" "ScheduleSlot" NOT NULL,
    "time" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_logs" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "decision" "Decision" NOT NULL,
    "sequenceConf" DOUBLE PRECISION NOT NULL,
    "detectionsJson" JSONB NOT NULL,
    "actionSequenceJson" JSONB NOT NULL,
    "videoRef" TEXT,
    "manualConfirmedBy" TEXT,
    "manualConfirmedAt" TIMESTAMP(3),
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "links_elderId_guardianId_key" ON "links"("elderId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_elderId_slot_key" ON "schedules"("elderId", "slot");

-- CreateIndex
CREATE INDEX "medication_logs_elderId_takenAt_idx" ON "medication_logs"("elderId", "takenAt");

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_manualConfirmedBy_fkey" FOREIGN KEY ("manualConfirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
