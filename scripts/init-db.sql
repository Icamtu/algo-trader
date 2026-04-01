-- Create a 'Viewer' for OpenClaw
-- NOTE: Please substitute 'YOUR_SECURE_PASSWORD' below with the 'READ_ONLY_PWD' value found in your .env file
CREATE USER claw_viewer WITH PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT USAGE ON SCHEMA public TO claw_viewer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claw_viewer;

-- Ensure future tables are also Read-Only for the viewer
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claw_viewer;
