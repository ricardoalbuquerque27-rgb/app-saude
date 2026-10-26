import { ImageResponse } from "next/og";
import { ICON_MASKABLE_DATA_URI } from "@/lib/appIcon";
import { NOME } from "@/lib/marca";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ICON_MASKABLE_DATA_URI} width={512} height={512} alt={NOME} />
    ),
    { width: 512, height: 512 }
  );
}
