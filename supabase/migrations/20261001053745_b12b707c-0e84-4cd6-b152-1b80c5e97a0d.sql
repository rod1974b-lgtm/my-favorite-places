CREATE TABLE public.saved_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved places" ON public.saved_places FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX saved_places_user_idx ON public.saved_places(user_id, position);