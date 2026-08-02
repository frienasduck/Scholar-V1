-- Normalize role values used before UserRole became a Prisma enum.
-- Existing administrators remain administrators; every other legacy value
-- becomes the least-privileged USER role.
UPDATE "User"
SET "role" = 'ADMIN'
WHERE lower("role") = 'admin';

UPDATE "User"
SET "role" = 'USER'
WHERE "role" NOT IN ('USER', 'ADMIN');
