import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const dataFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
    const fileData = fs.readFileSync(dataFilePath, 'utf8');
    const users = JSON.parse(fileData);

    const user = users[email];
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Mock token
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

    return NextResponse.json({ token, email }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
