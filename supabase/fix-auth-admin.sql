ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD 'postgres';
ALTER ROLE supabase_admin WITH LOGIN PASSWORD 'postgres';
ALTER ROLE authenticator WITH LOGIN PASSWORD 'postgres';
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_admin;
GRANT ALL ON SCHEMA public TO authenticator;
