-- Pin media goes private.
--
-- Until now the pin-media bucket was public: row-level security hid a
-- private pin's ROW from strangers, but the photo or video behind it was a
-- permanent URL anyone could open. From here on the bucket serves nothing
-- directly. The client mints short-lived signed URLs, and Storage only signs
-- an object when the caller can already see a pin_photos row that points at
-- it — which is exactly the pin's own visibility rule, reused.
--
-- Avatars stay public: a profile picture is shown wherever the profile is.
--
-- Also here: size and type limits on both buckets, so one account cannot
-- fill the storage quota or park arbitrary files behind a photo CDN.

update storage.buckets
set public = false,
    file_size_limit = 104857600, -- 100 MB, videos included
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'pin-media';

update storage.buckets
set file_size_limit = 2097152, -- 2 MB; the client already downscales
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

-- Rows written before this migration stored the full public URL. Keep just
-- the object path so the storage policy can match it by name.
update public.pin_photos
set storage_path = regexp_replace(storage_path, '^.*/storage/v1/object/public/pin-media/', '')
where storage_path like '%/storage/v1/object/public/pin-media/%';

create index if not exists pin_photos_storage_path_idx on public.pin_photos (storage_path);

drop policy if exists "pin_media_public_read" on storage.objects;
drop policy if exists "pin_media_read" on storage.objects;
create policy "pin_media_read" on storage.objects
  for select using (
    bucket_id = 'pin-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      -- pin_photos carries the parent pin's RLS, so this subquery only finds
      -- rows the caller may see: own pins, public pins, friends' pins.
      or exists (select 1 from public.pin_photos pp where pp.storage_path = storage.objects.name)
    )
  );
