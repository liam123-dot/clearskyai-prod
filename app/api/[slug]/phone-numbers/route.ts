import { NextRequest, NextResponse } from 'next/server';
import { getPhoneNumbersByOrganization } from '@/lib/phone-numbers';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // Get organization ID from slug
    const supabase = await createServiceClient();
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single();
    
    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Get phone numbers for this organization
    const phoneNumbers = await getPhoneNumbersByOrganization(org.id);
    
    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}

