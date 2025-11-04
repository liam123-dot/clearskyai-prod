import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/callback`,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/api/vapi/webhook',
      '/api/query/estate-agent/:id',
      '/api/query/estate-agent/:id/filters',
      '/api/stripe/webhook',
      '/api/number',
      'api/tools/:id/execute',
      '/api/call/:id/execute-start-tools',
      '/api/phone-number/:id/incoming',
      '/api/phone-number/:id/incoming/fallback',
    ],
  }
})

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except:
//      * - /demo and /demo/* (demo pages)
//      * - /api/calls/* (Twilio webhook routes)
//      * - /api/callback (auth callback)
//      * - /api/agents/* (agent routes)
//      * - /api/phone-number/* (phone number routes)
//      * - /api/tools/* (tool routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization)
//      * - favicon.ico (favicon)
//      */
//     '/((?!demo|api/calls|api/callback|api/agents|api/phone-number|api/tools|_next/static|_next/image|favicon.ico).*)',
//   ],
// };

export const config = {
  matcher: [
    // ... your existing matchers
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/).*)', 
    },
  ],
};