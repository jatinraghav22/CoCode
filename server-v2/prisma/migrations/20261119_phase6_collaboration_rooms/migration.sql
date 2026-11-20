-- Phase 6: Real-Time Collaboration — AddTable collaboration_rooms and room_participants
-- This migration is ADDITIVE and safe. It does NOT modify the existing `users` table.
-- Applied against TiDB Cloud (MySQL-compatible) via `prisma db push` or `prisma migrate deploy`.

-- CreateTable: collaboration_rooms
CREATE TABLE `collaboration_rooms` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isPrivate` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `collaboration_rooms_code_key`(`code`),
    INDEX `collaboration_rooms_code_idx`(`code`),
    INDEX `collaboration_rooms_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: room_participants
CREATE TABLE `room_participants` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `room_participants_roomId_idx`(`roomId`),
    INDEX `room_participants_userId_idx`(`userId`),
    UNIQUE INDEX `room_participants_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: room_documents
CREATE TABLE `room_documents` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'javascript',
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `room_documents_roomId_idx`(`roomId`),
    UNIQUE INDEX `room_documents_roomId_fileId_key`(`roomId`, `fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: collaboration_rooms.ownerId -> users.id
ALTER TABLE `collaboration_rooms` ADD CONSTRAINT `collaboration_rooms_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: room_participants.roomId -> collaboration_rooms.id
ALTER TABLE `room_participants` ADD CONSTRAINT `room_participants_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `collaboration_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: room_participants.userId -> users.id
ALTER TABLE `room_participants` ADD CONSTRAINT `room_participants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: room_documents.roomId -> collaboration_rooms.id
ALTER TABLE `room_documents` ADD CONSTRAINT `room_documents_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `collaboration_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
