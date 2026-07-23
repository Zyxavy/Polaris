CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_period
ON reviews(system_id, period_start, period_end);