-- Phase 7: Complete Projects & Coding Activity Implementation
-- Additive and safe migration. Preserves all existing TiDB tables and data.

-- CreateTable: projects
CREATE TABLE IF NOT EXISTS `projects` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `defaultLanguage` VARCHAR(191) NOT NULL DEFAULT 'javascript',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projects_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: project_files
CREATE TABLE IF NOT EXISTS `project_files` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'javascript',
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_files_projectId_idx`(`projectId`),
    UNIQUE INDEX `project_files_projectId_path_key`(`projectId`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: coding_activities
CREATE TABLE IF NOT EXISTS `coding_activities` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `durationSeconds` INT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coding_activities_userId_idx`(`userId`),
    INDEX `coding_activities_projectId_idx`(`projectId`),
    INDEX `coding_activities_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `coding_activities_userId_eventType_idx`(`userId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: projects.userId -> users.id
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_files.projectId -> projects.id
ALTER TABLE `project_files` ADD CONSTRAINT `project_files_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: coding_activities.userId -> users.id
ALTER TABLE `coding_activities` ADD CONSTRAINT `coding_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: coding_activities.projectId -> projects.id
ALTER TABLE `coding_activities` ADD CONSTRAINT `coding_activities_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
