// Deno-only helpers for Edge Functions. Not imported by the app.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** JSON response. Errors use `{ error: '<code>' }` with the same codes as the database. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** HTTP status for a business-rule error code raised by the database. */
export function statusForCode(code: string): number {
  switch (code) {
    case 'not_authenticated':
      return 401;
    case 'not_organizer':
      return 403;
    case 'not_found':
      return 404;
    default:
      return 409;
  }
}

export function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${names.join(' or ')}`);
}
