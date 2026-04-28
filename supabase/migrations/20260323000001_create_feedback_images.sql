-- Create feedback_images table to track images attached to feedback comments/evaluations
CREATE TABLE IF NOT EXISTS feedback_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id TEXT NOT NULL,  -- references feedback_comments.id OR human_feedback.id
  conversation_id TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feedback images"
  ON feedback_images FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own feedback images"
  ON feedback_images FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own feedback images"
  ON feedback_images FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Create storage bucket (public so URLs never expire)
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback_images', 'feedback_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload feedback images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback_images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view feedback images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback_images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own feedback images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'feedback_images' AND auth.uid()::text = (storage.foldername(name))[1]);
