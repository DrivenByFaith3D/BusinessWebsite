-- Access protections must be applied before optional performance indexes.
-- Run supabase/migrations/20261009_server_only_access.sql first.
-- It is safe to re-run and includes the newer Etsy/shop/product tables.

-- ============================================================
-- 2. ADD INDEXES ON FOREIGN KEY COLUMNS
--    (Fixes "unindexed foreign keys" performance warnings)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_order_user_id         ON "Order"              ("userId");
CREATE INDEX IF NOT EXISTS idx_message_order_id      ON "Message"            ("orderId");
CREATE INDEX IF NOT EXISTS idx_message_sender_id     ON "Message"            ("senderId");
CREATE INDEX IF NOT EXISTS idx_fileupload_order_id   ON "FileUpload"         ("orderId");
CREATE INDEX IF NOT EXISTS idx_pwreset_user_id       ON "PasswordResetToken" ("userId");
CREATE INDEX IF NOT EXISTS idx_quotehistory_order_id ON "QuoteHistory"       ("orderId");
CREATE INDEX IF NOT EXISTS idx_orderevent_order_id   ON "OrderEvent"         ("orderId");
CREATE INDEX IF NOT EXISTS idx_orderphoto_order_id   ON "OrderPhoto"         ("orderId");
CREATE INDEX IF NOT EXISTS idx_address_user_id       ON "Address"            ("userId");
CREATE INDEX IF NOT EXISTS idx_review_product_id     ON "Review"             ("productId");
CREATE INDEX IF NOT EXISTS idx_review_user_id        ON "Review"             ("userId");
