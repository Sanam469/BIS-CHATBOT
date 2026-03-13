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

    if (users[email]) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    users[email] = { password }; 
    fs.writeFileSync(dataFilePath, JSON.stringify(users, null, 2));

    return NextResponse.json({ message: 'User registered successfully' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
