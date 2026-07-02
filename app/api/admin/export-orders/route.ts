import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get("x-sync-secret") ?? "";
  const expected = process.env.ORDER_EXPORT_SECRET ?? "";
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function defaultRange(): { since: Date; until: Date } {
  const now = new Date();
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { since, until };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sinceParam = searchParams.get("since");
  const untilParam = searchParams.get("until");

  let since: Date;
  let until: Date;
  if (sinceParam && untilParam) {
    since = new Date(sinceParam);
    until = new Date(untilParam);
    if (isNaN(since.getTime()) || isNaN(until.getTime())) {
      return NextResponse.json({ error: "Invalid since/until" }, { status: 400 });
    }
  } else {
    ({ since, until } = defaultRange());
  }

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "paid",
      deletedAt: null,
      createdAt: { gte: since, lt: until },
    },
    select: {
      id: true,
      description: true,
      quote: true,
      quantity: true,
      status: true,
      orderType: true,
      orderNumber: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });

  const flattened = orders.map((o) => ({
    id: o.id,
    description: o.description,
    quote: o.quote,
    quantity: o.quantity,
    status: o.status,
    orderType: o.orderType,
    orderNumber: o.orderNumber,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    createdAt: o.createdAt,
    customerEmail: o.user?.email ?? null,
    customerName: o.user?.name ?? null,
  }));

  return NextResponse.json({
    orders: flattened,
    range: { since: since.toISOString(), until: until.toISOString() },
    count: flattened.length,
  });
}
