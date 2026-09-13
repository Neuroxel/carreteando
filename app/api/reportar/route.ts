import { receiveCommunity } from '../../../lib/community-api';
export async function POST(request: Request) {
  return receiveCommunity(request, 'report');
}
