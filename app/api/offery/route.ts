import { NextResponse } from 'next/server';

export async function GET() {
  // المفتاح الكامل كما في صورتك (32 حرف تماماً)
  const API_KEY = "uccnjpr7cd6llvbomgr04no1hofoobb1";

  try {
    // الرابط الرسمي من الدليل: apikey فقط
    const url = `https://offery.io/api/?apikey=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    const data = await response.json();
    
    // إرجاع البيانات للصفحة
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ status: "error", message: "Fetch failed" }, { status: 500 });
  }
}
