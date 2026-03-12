-- Normalize orderStatus casing for legacy data (manual execution by DBA only)
-- NOTE: Review impacted flows before running in production.

UPDATE orderDetail 
SET orderStatus = LOWER(orderStatus) 
WHERE orderStatus != LOWER(orderStatus);

