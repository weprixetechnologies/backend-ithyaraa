ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS returnRejectionReason TEXT DEFAULT NULL AFTER returnPhotos;

ALTER TABLE refund_queries
  ADD COLUMN IF NOT EXISTS adminRejectionReason TEXT DEFAULT NULL AFTER photos;

ALTER TABLE refund_queries_resolved
  ADD COLUMN IF NOT EXISTS adminRejectionReason TEXT DEFAULT NULL AFTER photos;

ALTER TABLE presale_products
  ADD COLUMN IF NOT EXISTS sizeChartUrl VARCHAR(1024) DEFAULT NULL AFTER allowCustomerImageUpload;
