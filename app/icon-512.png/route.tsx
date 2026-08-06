import { ImageResponse } from "next/og";
import { ICON_DATA_URI } from "@/lib/appIcon";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ICON_DATA_URI} width={512} height={512} alt="Pace Fit" />
    ),
    { width: 512, height: 512 }
  );
}
