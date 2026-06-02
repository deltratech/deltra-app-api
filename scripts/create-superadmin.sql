-- Create the required extensions if they are not present yet.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Insert a platform superadmin into public.platform_users.
-- Replace the email, username, full name, and password as needed.
INSERT INTO public.platform_users (
  id,
  email,
  username,
  password_hash,
  full_name,
  role,
  network_id,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'superadmin@deltra.id',
  'superadmin',
  crypt('superadmin123!', gen_salt('bf')),
  'Deltra Superadmin',
  'superadmin',
  NULL,
  'active',
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  network_id = EXCLUDED.network_id,
  status = EXCLUDED.status,
  updated_at = now();
