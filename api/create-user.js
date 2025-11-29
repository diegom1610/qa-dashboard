import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  const json = await req.json();

  const email = json.email;
  const password = json.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Read Supabase URL + admin token injected by Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceToken = req.headers.get("x-vercel-supabase-token");

  if (!supabaseServiceToken) {
    return NextResponse.json(
      { error: "Missing admin token from Vercel" },
      { status: 401 }
    );
  }

  // Create Supabase client with admin token
  const supabase = createClient(supabaseUrl, supabaseServiceToken);

  // Create user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Optional
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    user: data.user,
  });
}
