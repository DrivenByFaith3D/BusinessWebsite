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

// Etsy's standard US seller fees, estimated from the order total when the exact
// figure hasn't been pulled from Etsy's payment-account ledger yet:
//   6.5% transaction + (3% + $0.25) payment processing + $0.20 per item listing.
function estimateEtsyFees(grandTotal: number | null, itemCount: number): number {
  if (!grandTotal) return 0;
  const transaction = grandTotal * 0.065;
  const processing = grandTotal * 0.03 + 0.25;
  const listing = itemCount * 0.2;
  return transaction + processing + listing;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// A single sale from any channel, normalised so the expense tracker can ingest
// custom, Etsy, and storefront orders through one path.
type Sale = {
  source: "custom" | "etsy" | "shop";
  externalId: string;
  item: string;
  // gross = what the seller actually charged (goods + shipping), excluding any
  // pass-through sales tax that the marketplace collects and remits.
  gross: number;
  fees: number;
  shipping: number;
  // net = gross - fees - shipping.
  net: number;
  customer: string | null;
  date: string; // ISO
  status: string;
};

const PAID_SHOP = ["paid", "shipped", "delivered"];

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

  const [customOrders, etsyOrders, shopOrders] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "paid", deletedAt: null, createdAt: { gte: since, lt: until } },
      select: {
        id: true,
        description: true,
        quote: true,
        status: true,
        orderNumber: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.etsyOrder.findMany({
      where: { isPaid: true, orderedAt: { gte: since, lt: until } },
      select: {
        receiptId: true,
        buyerName: true,
        isShipped: true,
        grandTotal: true,
        salesTax: true,
        etsyFees: true,
        labelCost: true,
        etsyLabelCost: true,
        orderedAt: true,
        items: { select: { title: true, quantity: true } },
      },
      orderBy: { orderedAt: "asc" },
      take: 5000,
    }),
    prisma.shopOrder.findMany({
      where: { status: { in: PAID_SHOP }, createdAt: { gte: since, lt: until } },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        total: true,
        createdAt: true,
        paidAt: true,
        items: { select: { name: true, quantity: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);

  const sales: Sale[] = [];

  for (const o of customOrders) {
    const gross = round2(o.quote ?? 0);
    sales.push({
      source: "custom",
      externalId: o.id,
      item: o.description,
      gross,
      fees: 0,
      shipping: 0,
      net: gross,
      customer: o.user?.name ?? o.user?.email ?? null,
      date: o.createdAt.toISOString(),
      status: o.status,
    });
  }

  for (const o of etsyOrders) {
    const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
    const salesTax = o.salesTax ?? 0;
    const gross = round2((o.grandTotal ?? 0) - salesTax);
    const fees = round2(o.etsyFees ?? estimateEtsyFees(o.grandTotal, itemCount));
    const shipping = round2(o.labelCost ?? o.etsyLabelCost ?? 0);
    const title =
      o.items.length > 0
        ? o.items.map((i) => i.title).join(", ")
        : `Etsy Order #${o.receiptId}`;
    sales.push({
      source: "etsy",
      externalId: `etsy-${o.receiptId}`,
      item: title,
      gross,
      fees,
      shipping,
      net: round2(gross - fees - shipping),
      customer: o.buyerName,
      date: o.orderedAt.toISOString(),
      status: o.isShipped ? "Shipped" : "Paid",
    });
  }

  for (const o of shopOrders) {
    const gross = round2(o.total);
    const title =
      o.items.length > 0
        ? o.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(", ")
        : `Store order ${o.orderNumber ?? o.id}`;
    sales.push({
      source: "shop",
      externalId: `shop-${o.id}`,
      item: title,
      gross,
      fees: 0,
      shipping: 0,
      net: gross,
      customer: o.email,
      date: (o.paidAt ?? o.createdAt).toISOString(),
      status: o.status,
    });
  }

  return NextResponse.json({
    sales,
    range: { since: since.toISOString(), until: until.toISOString() },
    count: sales.length,
  });
}
