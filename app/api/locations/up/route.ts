import { NextRequest, NextResponse } from "next/server";

import postalData from "@/data/up-postal-directory.json";

type PostalArea = {
  name: string;
  pincode: string;
  delivery: boolean;
};

type PostalDirectory = {
  country: string;
  state: string;
  source: string;
  sourceUrl: string;
  directory: Record<string, PostalArea[]>;
};

const data = postalData as PostalDirectory;
const districts = Object.keys(data.directory);
const pincodeIndex = new Map<
  string,
  Array<PostalArea & { district: string }>
>();

for (const [district, areas] of Object.entries(data.directory)) {
  for (const area of areas) {
    const matches = pincodeIndex.get(area.pincode) ?? [];
    matches.push({ ...area, district });
    pincodeIndex.set(area.pincode, matches);
  }
}

function areaId(area: PostalArea) {
  return `${area.name}|${area.pincode}`;
}

function publicArea(area: PostalArea) {
  return {
    id: areaId(area),
    name: area.name,
    pincode: area.pincode,
    delivery: area.delivery,
  };
}

export async function GET(request: NextRequest) {
  const districtQuery = request.nextUrl.searchParams.get("district")?.trim();
  const pincode = request.nextUrl.searchParams.get("pincode")?.trim();

  if (pincode) {
    if (!/^\d{6}$/.test(pincode)) {
      return NextResponse.json(
        { error: "Enter a complete six-digit PIN code." },
        { status: 400 },
      );
    }
    const matches = pincodeIndex.get(pincode);
    if (!matches?.length) {
      return NextResponse.json(
        { error: "This PIN code is not in Uttar Pradesh." },
        { status: 404 },
      );
    }
    const preferred = [...matches].sort(
      (left, right) => Number(right.delivery) - Number(left.delivery),
    )[0];
    return NextResponse.json({
      country: data.country,
      state: data.state,
      district: preferred.district,
      selectedAreaId: areaId(preferred),
      areas: matches.map(publicArea),
      source: data.source,
    });
  }

  if (districtQuery) {
    const district = districts.find(
      (name) => name.toLowerCase() === districtQuery.toLowerCase(),
    );
    if (!district) {
      return NextResponse.json(
        { error: "Choose a valid Uttar Pradesh district." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      country: data.country,
      state: data.state,
      district,
      areas: data.directory[district].map(publicArea),
      source: data.source,
    });
  }

  return NextResponse.json({
    country: data.country,
    state: data.state,
    districts,
    source: data.source,
  });
}
