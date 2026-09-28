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

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = await signAdminToken({
      adminId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    });

    const response = NextResponse.json({
      success: true,
      admin: { email: admin.email, role: admin.role },
    });

    return setAuthCookie(response, token);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
