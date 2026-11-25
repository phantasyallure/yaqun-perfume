# Yaqine store (Cloudflare Pages + D1 + R2)

First deploy (from this folder; npx downloads wrangler):
1. npx wrangler login
2. npx wrangler d1 create yaqine-db        -> copy database_id into wrangler.toml
3. npx wrangler r2 bucket create yaqine-images
4. npx wrangler d1 execute yaqine-db --remote --file=schema.sql
5. npx wrangler pages project create yaqine --production-branch main
6. npx wrangler pages secret put ADMIN_PASSWORD --project-name yaqine
7. npx wrangler pages deploy

Already deployed the previous version? Run these two, then redeploy:
  npx wrangler d1 execute yaqine-db --remote --command "ALTER TABLE products ADD COLUMN size TEXT NOT NULL DEFAULT ''"
  npx wrangler d1 execute yaqine-db --remote --file=schema.sql

Shop: https://yaqine.pages.dev   Admin: https://yaqine.pages.dev/admin
WhatsApp, contact info, social links and pixels are edited in the admin (Settings / Marketing).

## Telegram order alerts
1. In Telegram, open @BotFather, send /newbot, follow the steps, and copy the bot token.
2. Open your new bot and press Start (the bot can only message you after this).
3. Get your chat ID: send any message to @userinfobot, it replies with your ID.
   (For a group: add the bot to the group; the group ID starts with a minus sign.)
4. Put the ID in wrangler.toml as TELEGRAM_CHAT_ID (several IDs: "111,222").
5. Save the token as a secret:  npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name yaqine
6. npx wrangler pages deploy
7. Admin > Settings > "Send test message".

## Product pages
Every product has its own page at /p/<name>-<id> (open a product in the admin and tap "Voir la page du produit" to get the link). Share that link in ads and posts.
