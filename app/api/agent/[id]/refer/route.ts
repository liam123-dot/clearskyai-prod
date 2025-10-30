// /api/calls/refer-handler/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Log all parameters
    console.log('\n📞 SIP REFER RECEIVED:')
    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => {
      allParams[key] = value.toString()
      console.log(`  ${key}: ${value}`)
    })
    
    const referTransferTarget = formData.get('ReferTransferTarget') as string
    const callSid = formData.get('CallSid') as string
    const to = formData.get('To') as string // Save this for potential fallback

    // Parse the tel: URI - remove angle brackets and tel: prefix
    // Input: '<tel:+447418350696>' or 'tel:+447418350696' or 'sip:+447418350696@domain'
    const phoneNumber = referTransferTarget
      .replace(/[<>]/g, '')  // Remove angle brackets
      .replace('tel:', '')    // Remove tel: prefix
      .replace('sip:', '')    // Remove sip: prefix if present
      .split('@')[0]          // Take only the part before @ if SIP URI
      .trim()
    
    console.log(`✅ Parsed phone number: ${phoneNumber}`)
    console.log(`📞 Original To parameter: ${to}`)

    // Build callback URL with the original 'To' parameter for fallback
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/incoming/transfer-no-answer`
    
    // Return TwiML to dial the transfer target
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${callbackUrl}" timeout="30" answerOnBridge="true">
    <Number>${phoneNumber}</Number>
  </Dial>
</Response>`

    // const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    // <Response>
    //   <Dial>
    //     <Number>${phoneNumber}</Number>
    //   </Dial>
    // </Response>`

    console.log('📤 Returning TwiML:', twiml)

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
    
  } catch (error) {
    console.error('❌ Error in refer handler:', error)
    
    // Return error TwiML
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, the transfer could not be completed.</Say>
  <Hangup/>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SIP REFER handler endpoint',
    note: 'This endpoint handles SIP REFER requests from LiveKit agent transfers'
  })
}