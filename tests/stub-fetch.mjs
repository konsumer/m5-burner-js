const firmwarePayload = [{ fid: 'demo-fid', name: 'Demo Firmware' }];

export default async function stubFetch(url) {
  if (url.includes('/api/firmware')) {
    return new Response(JSON.stringify(firmwarePayload), { status: 200 });
  }

  if (url.includes('/api/v1/device/list')) {
    return new Response(JSON.stringify({ code: 200, data: [] }), { status: 200 });
  }

  throw new Error(`Unhandled URL in stub fetch: ${url}`);
}
