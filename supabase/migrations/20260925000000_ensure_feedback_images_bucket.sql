-- Ensure the feedback_images storage bucket exists and its access policies are in place.
-- Images in comments were showing as broken with "Bucket not found": the bucket was
-- either never created in production or created as private (the original migration's
-- ON CONFLICT DO NOTHING leaves an existing private bucket untouched).
-- Safe to run more than once.

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback_images', 'feedback_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated users can upload feedback images" ON storage.objects;
CREATE POLICY "Authenticated users can upload feedback images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback_images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view feedback images" ON storage.objects;
CREATE POLICY "Authenticated users can view feedback images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback_images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own feedback images" ON storage.objects;
CREATE POLICY "Users can delete their own feedback images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'feedback_images' AND auth.uid()::text = (storage.foldername(name))[1]);
