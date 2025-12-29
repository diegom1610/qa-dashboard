/**
 * USER CREATION EDGE FUNCTION
 *
 * PURPOSE:
 * Allows creating user accounts via API call since Supabase UI is not accessible.
 *
 * USAGE:
 * POST to this endpoint with email and password to create a new user.
 *
 * SECURITY:
 * This function uses SERVICE_ROLE_KEY which has elevated permissions.
 * In production, you should add authentication to prevent unauthorized access.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  role?: 'agent' | 'evaluator' | 'admin';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, role = 'agent' }: CreateUserRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: 'Email and password are required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    const { error: settingsError } = await supabase.from('user_settings').insert({
      user_id: authData.user.id,
      role: role,
      timezone: 'UTC',
    });

    if (settingsError) {
      console.error('Error creating user settings:', settingsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: role,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create user',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});