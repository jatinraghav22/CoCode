-- Phase 6: Add yjsState to room_documents for full CRDT persistence
-- Safe, additive migration. Nullable column preserves existing records.
ALTER TABLE `room_documents` ADD COLUMN `yjsState` LONGBLOB NULL;
