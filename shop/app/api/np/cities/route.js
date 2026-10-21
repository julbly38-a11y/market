import { searchCities } from '../../../../lib/np';

export async function GET(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 60) return Response.json({ cities: [] });
  try {
    return Response.json({ cities: await searchCities(q) });
  } catch (err) {
    console.error('np cities', err);
    return Response.json({ cities: [], error: 'np_unavailable' }, { status: 502 });
  }
}
