/*
  Warnings:

  - You are about to drop the column `avatar_public_url` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatar_public_url",
ADD COLUMN     "avatar_public_id" TEXT;
