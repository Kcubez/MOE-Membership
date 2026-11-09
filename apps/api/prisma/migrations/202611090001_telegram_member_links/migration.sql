CREATE TABLE "telegram_member_links" (
    "telegramId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    CONSTRAINT "telegram_member_links_pkey" PRIMARY KEY ("telegramId"),
    CONSTRAINT "telegram_member_links_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "moe_auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "telegram_member_links_userId_key" ON "telegram_member_links"("userId");
