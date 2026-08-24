-- naji_record 加 question 列 · 用户可选写下问事内容(只留档,不参与算力)
ALTER TABLE naji_record ADD COLUMN IF NOT EXISTS question TEXT;
