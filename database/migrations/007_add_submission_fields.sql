ALTER TABLE vulnerability_reports
ADD COLUMN IF NOT EXISTS submission_id NUMERIC(78,0),
ADD COLUMN IF NOT EXISTS requested_reward_wei NUMERIC(78,0);

CREATE INDEX IF NOT EXISTS vulnerability_reports_submission_id_index
ON vulnerability_reports(submission_id);