import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { verifyAdminKey } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authError = verifyAdminKey(req);
  if (authError) return authError;

  const rows = await db.select().from(waitlist).orderBy(asc(waitlist.createdAt));

  const format = req.nextUrl.searchParams.get("format");

  if (format === "csv") {
    const sanitize = (v: string) =>
      /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    const csv = ["email,joined_at"]
      .concat(rows.map((r) => `${sanitize(r.email)},${new Date(r.createdAt * 1000).toISOString()}`))
      .join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=waitlist.csv",
      },
    });
  }

  return NextResponse.json({ total: rows.length, data: rows });
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }

  try {
    await db.insert(waitlist).values({
      email,
      createdAt: Math.floor(Date.now() / 1000),
    });
    return NextResponse.json({ message: "Berhasil bergabung!" });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
