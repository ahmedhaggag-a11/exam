-- Run this in Supabase SQL Editor to allow uploads to the pdfs bucket

-- Allow all authenticated users to read pdfs
CREATE POLICY "Allow public read access on pdfs bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

-- Allow admins to insert/upload pdfs
CREATE POLICY "Allow admins to insert pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdfs' AND public.is_admin());

-- Allow admins to update pdfs
CREATE POLICY "Allow admins to update pdfs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pdfs' AND public.is_admin());

-- Allow admins to delete pdfs
CREATE POLICY "Allow admins to delete pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdfs' AND public.is_admin());

-- (Optional) If you want teachers to upload too, you could add:
-- CREATE POLICY "Allow teachers to insert pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs');
