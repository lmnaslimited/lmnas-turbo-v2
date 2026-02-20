import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer(
  http.get('http://localhost:1337/api/pages', () => {
    return HttpResponse.json({ data: [] });
  })
);
