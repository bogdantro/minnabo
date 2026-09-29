-- 0022_drop_dev_otp.sql — remove the dev/test OTP backdoor from 0005.
--
-- `get_dev_otp` was callable by anon, so on any project where the `auth-email`
-- hook was registered anyone could read anyone's login code. The app now uses
-- Supabase's real email delivery only.

drop function if exists get_dev_otp(text);
drop function if exists set_dev_otp(text, text);
drop table if exists dev_otp_codes;
