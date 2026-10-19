import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb/connect';
import Admin from '@/models/Admin';
import { signAdminToken, setAuthCookie } from '@/lib/auth/auth';



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    await connectDB();

    const normalizedEmail = email.toLowerCase().trim();
    const admin = await Admin.findOne({ email: normalizedEmail }).lean();
    if (!admin) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await signAdminToken({
      adminId: (admin._id as { toString(): string }).toString(),
      email: admin.email,
      role: admin.role,
    });

    const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    const isHttps = proto === 'https';
    const isSecure = process.env.NODE_ENV === 'production' && isHttps;

    const response = NextResponse.json({
      success: true,
      admin: { email: admin.email, role: admin.role },
      redirectUrl: '/admin/dashboard',
    });

    return setAuthCookie(response, token, isSecure);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login service temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
