// Serves the browser config for the static Premier League predictor at /pl.
// Only public values (Supabase URL + anon key, already shipped to every browser by the main app).
// All predictor data access goes through locked-down pl_* RPC functions in Supabase.
export const dynamic = 'force-static';

export function GET() {
  const config = {
    comp: 'pl',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
  return new Response(`window.PL_CONFIG = ${JSON.stringify(config)};\n`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
