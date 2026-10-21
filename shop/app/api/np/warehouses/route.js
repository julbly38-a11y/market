import { getBranches } from '../../../../lib/np';

export async function GET(req) {
  const city = new URL(req.url).searchParams.get('city') || '';
  if (!/^[0-9a-f-]{36}$/i.test(city)) return Response.json({ warehouses: [] }, { status: 400 });
  try {
    return Response.json({ warehouses: await getBranches(city) });
  } catch (err) {
    console.error('np warehouses', err);
    return Response.json({ warehouses: [], error: 'np_unavailable' }, { status: 502 });
  }
}
