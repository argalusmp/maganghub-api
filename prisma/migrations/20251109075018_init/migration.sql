-- DropForeignKey
ALTER TABLE "internships" DROP CONSTRAINT "internships_kode_provinsi_fkey";

-- DropForeignKey
ALTER TABLE "new_internship_events" DROP CONSTRAINT "new_internship_events_id_posisi_fkey";

-- DropIndex
DROP INDEX "idx_internships_jenjang_gin";

-- DropIndex
DROP INDEX "idx_internships_program_studi_gin";

-- DropIndex
DROP INDEX "idx_new_internship_events_seen_at";

-- CreateIndex
CREATE INDEX "idx_new_internship_events_seen_at" ON "new_internship_events"("seen_at");

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_kode_provinsi_fkey" FOREIGN KEY ("kode_provinsi") REFERENCES "provinces"("kode_propinsi") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_internship_events" ADD CONSTRAINT "new_internship_events_id_posisi_fkey" FOREIGN KEY ("id_posisi") REFERENCES "internships"("id_posisi") ON DELETE CASCADE ON UPDATE CASCADE;
