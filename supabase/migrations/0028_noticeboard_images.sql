-- Oppslagstavle (design/screens/Oppslagstavle.dc.html): optional photo on a post.
-- The file lives in the existing `listing-images` bucket under the author's folder.
alter table noticeboard_posts add column if not exists image_path text;
