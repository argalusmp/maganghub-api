CREATE TABLE IF NOT EXISTS public.provinces (
    kode_propinsi TEXT PRIMARY KEY,
    id_propinsi UUID,
    nama_propinsi TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sync_state (
    key TEXT PRIMARY KEY,
    value TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sync_runs (
    id UUID PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    pages_fetched INTEGER NOT NULL DEFAULT 0,
    items_inserted INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_deactivated INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    note TEXT
);

CREATE TABLE IF NOT EXISTS public.internships (
    id_posisi UUID PRIMARY KEY,
    posisi TEXT,
    deskripsi_posisi TEXT,
    jumlah_kuota INTEGER,
    jumlah_terdaftar INTEGER,
    program_studi TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    jenjang TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    nama_perusahaan TEXT,
    kode_provinsi TEXT REFERENCES public.provinces (kode_propinsi) ON DELETE SET NULL,
    nama_provinsi TEXT,
    kode_kabupaten TEXT,
    nama_kabupaten TEXT,
    pendaftaran_awal TIMESTAMPTZ,
    pendaftaran_akhir TIMESTAMPTZ,
    mulai TIMESTAMPTZ,
    selesai TIMESTAMPTZ,
    agency TEXT,
    sub_agency TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    source_raw JSONB,
    first_seen_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tsv TSVECTOR
);

CREATE TABLE IF NOT EXISTS public.new_internship_events (
    id BIGSERIAL PRIMARY KEY,
    id_posisi UUID NOT NULL REFERENCES public.internships (id_posisi) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internships_program_studi_gin ON public.internships USING GIN (program_studi);
CREATE INDEX IF NOT EXISTS idx_internships_jenjang_gin ON public.internships USING GIN (jenjang);
CREATE INDEX IF NOT EXISTS idx_internships_provinsi_kabupaten ON public.internships (kode_provinsi, nama_kabupaten);
CREATE INDEX IF NOT EXISTS idx_internships_pendaftaran_akhir ON public.internships (pendaftaran_akhir);
CREATE INDEX IF NOT EXISTS idx_internships_jumlah_kuota ON public.internships (jumlah_kuota);
CREATE INDEX IF NOT EXISTS idx_internships_jumlah_terdaftar ON public.internships (jumlah_terdaftar);
CREATE INDEX IF NOT EXISTS idx_internships_first_seen_at ON public.internships (first_seen_at);
CREATE INDEX IF NOT EXISTS idx_internships_updated_at ON public.internships (updated_at);
CREATE INDEX IF NOT EXISTS idx_new_internship_events_seen_at ON public.new_internship_events (seen_at DESC);

CREATE OR REPLACE FUNCTION public.internships_tsv_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.tsv :=
        setweight(to_tsvector('indonesian', coalesce(NEW.posisi, '')), 'A') ||
        setweight(to_tsvector('indonesian', coalesce(NEW.deskripsi_posisi, '')), 'B') ||
        setweight(to_tsvector('indonesian', array_to_string(NEW.program_studi, ' ')), 'C') ||
        setweight(to_tsvector('indonesian', array_to_string(NEW.jenjang, ' ')), 'C');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_internships_tsv ON public.internships;
CREATE TRIGGER trg_internships_tsv
BEFORE INSERT OR UPDATE ON public.internships
FOR EACH ROW
EXECUTE FUNCTION public.internships_tsv_refresh();
