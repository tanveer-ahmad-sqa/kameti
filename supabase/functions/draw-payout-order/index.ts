// Runs the random payout-order draw for a committee.
//
// Security:
//  * The caller must send their Supabase JWT; the user is resolved from it (never from the body).
//  * Randomness: Fisher–Yates with crypto.getRandomValues and rejection sampling (no modulo bias).
//  * The result is written by `public.apply_draw_result`, which only the service role can call.
//    It re-checks that the caller is the organizer, the committee is a draft using the random
//    method with every member added, and that the order is a permutation of those members.
//    It also records the draw permanently in `payout_draws` and the activity log.
import { createClient } from '@supabase/supabase-js';

import { corsHeaders, json, requiredEnv, statusForCode } from '../_shared/http.ts';
import { drawRequestSchema } from '../_shared/schemas/draw.ts';
import { SHUFFLE_ALGORITHM, secureShuffle } from '../_shared/secureShuffle.ts';

const SUPABASE_URL = requiredEnv('SUPABASE_URL');
const PUBLIC_KEY = requiredEnv('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'not_authenticated' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'not_authenticated' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  const parsed = drawRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid_request' }, 400);
  }
  const { committeeId } = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Stable input order so the shuffle is the only source of variation.
  const { data: members, error: membersError } = await admin
    .from('committee_members')
    .select('id')
    .eq('committee_id', committeeId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (membersError) {
    console.error('draw: failed to load members', membersError);
    return json({ error: 'unknown' }, 500);
  }

  const order = secureShuffle(members.map((member) => member.id as string));

  const { data: result, error: drawError } = await admin.rpc('apply_draw_result', {
    p_committee_id: committeeId,
    p_actor: userData.user.id,
    p_member_ids: order,
    p_algorithm: SHUFFLE_ALGORITHM,
  });
  if (drawError) {
    if (drawError.code === 'P0001') {
      return json({ error: drawError.message }, statusForCode(drawError.message));
    }
    console.error('draw: apply_draw_result failed', drawError);
    return json({ error: 'unknown' }, 500);
  }

  return json({ order: result });
});
