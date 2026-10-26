import { ImageResponse } from "next/og";
import { ICON_DATA_URI } from "@/lib/appIcon";
import { NOME } from "@/lib/marca";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ICON_DATA_URI} width={192} height={192} alt={NOME} />
    ),
    { width: 192, height: 192 }
  );
}
