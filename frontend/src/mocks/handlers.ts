import { HttpResponse, http } from 'msw';

export const handlers = [
  http.get(/\/api\/mock\/example$/, () => HttpResponse.json({ status: 'ok' })),
];
