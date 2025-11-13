-- Create call_annotations table
CREATE TABLE IF NOT EXISTS call_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  annotation_level TEXT NOT NULL CHECK (annotation_level IN ('call', 'transcript_item')),
  transcript_item_index INTEGER,
  issue_category TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_annotations_call_id ON call_annotations(call_id);
CREATE INDEX IF NOT EXISTS idx_call_annotations_org_id ON call_annotations(organization_id);

-- Create unique constraint: only one call-level annotation per call per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_annotations_unique_call_level 
  ON call_annotations(call_id, organization_id) 
  WHERE annotation_level = 'call';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_call_annotations_updated_at
  BEFORE UPDATE ON call_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_call_annotations_updated_at();

