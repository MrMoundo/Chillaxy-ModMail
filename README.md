# DM-Ticket Bot

بوت تكتات عبر الـ DM لتحويل الرسائل إلى ثريدات دعم داخل السيرفر، مع تسجيل اللوجات والتقييمات.

## المتطلبات
- Node.js 18+
- صلاحيات البوت في السيرفر: `Read Messages`, `Send Messages`, `Manage Threads`, `Manage Channels`, `Embed Links`, `Attach Files`
- تفعيل الـ Intents المطلوبة في بوابة الديسكورد:
  - `Guilds`
  - `GuildMessages`
  - `DirectMessages`
  - `MessageContent`
  - `GuildMembers`
  - `GuildPresences`

## الإعداد السريع
1. أضف التوكن في `.env`.
2. ثبّت الاعتمادات: `npm install`.
3. شغل البوت: `node index.js`.
3. نفذ الأمر: `/setup` لتحديد القنوات والأدوار.

## الأوامر (Slash Commands)

### `/setup`
إعداد البوت أول مرة وتحديد القنوات والأدوار.
- `support_channel` (إجباري): قناة الدعم التي تُنشأ فيها الثريدات.
- `logs_channel` (إجباري): قناة اللوج.
- `support_role` (إجباري): رتبة الدعم المسموح لها بالرد والإغلاق.
- `language` (إجباري): اللغة الافتراضية.
- `mention_role` (اختياري): رتبة يتم منشنها عند فتح تكت.
- `embed_color` (اختياري): لون الـ Embed.
- `banner_url` (اختياري): بانر يظهر في بعض الـ Embeds.

### `/set-admin-role`
تحديد رتبة الأدمن المسؤولة عن الإدارة.
- `role` (إجباري): رتبة الأدمن.

### `/config set`
تعديل إعدادات البوت بعد الإعداد الأولي.
- نفس خيارات `/setup` تقريبًا لكن كلها اختيارية.

### `/config show`
عرض الإعدادات الحالية للسيرفر.

### `/blacklist add`
حظر مستخدم من فتح التكتات.
- `user` (إجباري)
- `reason` (اختياري)

### `/blacklist remove`
إزالة الحظر الدائم عن مستخدم.
- `user` (إجباري)

### `/blacklist list`
عرض قائمة المحظورين دائمًا.

### `/tempblacklist add`
حظر مؤقت لمستخدم.
- `user` (إجباري)
- `duration_minutes` (إجباري)
- `reason` (اختياري)

### `/tempblacklist remove`
إزالة الحظر المؤقت.
- `user` (إجباري)

### `/tempblacklist list`
عرض قائمة المحظورين مؤقتًا.

### `/toprank`
عرض أفضل أعضاء الدعم حسب التكتات التي تم التعامل معها.

### `/purge-user`
حذف بيانات التكت الخاصة بمستخدم محدد.
- `user` (إجباري)

### `/close-all`
إغلاق كل التكتات المفتوحة، حفظ الترانسكربت في اللوج، ثم حذف الثريدات.

### `/voice set`
تحديد فويس يظل البوت فيها دائمًا.
- `channel` (إجباري): قناة الفويس.

### `/voice clear`
إلغاء التحديد وخروج البوت من الفويس.

## أوامر نصية (داخل الثريد)
### `!close`
إغلاق التكت يدويًا من داخل الثريد (لأعضاء الدعم فقط).

## حقوق المطور
- Discord: `moundo1`
- Server Discord: `https://discord.gg/AsgyCjWf2r`
- GitHub: `https://github.com/MrMoundo`
- YouTube: `https://www.youtube.com/@Mr-Moundo`
