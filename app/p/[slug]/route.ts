import { NextRequest } from "next/server";
import { resolvePaySlugRedirect } from "@/lib/payRedirect";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return resolvePaySlugRedirect(request.url, slug);
}
