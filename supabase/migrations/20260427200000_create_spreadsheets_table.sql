-- Create spreadsheets table for storing user spreadsheet files in the database

CREATE TABLE IF NOT EXISTS spreadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled Spreadsheet',
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_spreadsheets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER spreadsheets_updated_at
  BEFORE UPDATE ON spreadsheets
  FOR EACH ROW EXECUTE FUNCTION update_spreadsheets_updated_at();

-- RLS: users can only see their own spreadsheets
ALTER TABLE spreadsheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spreadsheets"
  ON spreadsheets FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own spreadsheets"
  ON spreadsheets FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own spreadsheets"
  ON spreadsheets FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own spreadsheets"
  ON spreadsheets FOR DELETE
  USING (auth.uid() = created_by);
