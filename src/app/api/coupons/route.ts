import { NextResponse } from "next/server";
import { getAllCoupons } from "@/lib/coupons/aggregator";

export async function GET() {
  const coupons = await getAllCoupons();
  return NextResponse.json({ coupons });
}
