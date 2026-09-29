UPDATE auth.users
SET encrypted_password = extensions.crypt('GasbeeRider2026!', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'e062e240-84ca-4b8a-8cef-19150724265a';