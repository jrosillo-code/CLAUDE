-- Pins can carry videos as well as photos. pin_photos becomes the general
-- media table: each row is a photo or a video clip in display order.

alter table pin_photos
  add column if not exists kind text not null default 'photo'
    check (kind in ('photo', 'video'));

comment on table pin_photos is
  'Pin media (photos and videos), ordered by sort_order. kind distinguishes clips.';
