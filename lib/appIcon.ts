// SVG do ícone do app (halteres em verde da marca), reutilizado para gerar
// os PNGs do manifesto e o apple-touch-icon via next/og.
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#0c964b"/>
  <g fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 200v112M362 200v112M150 256h212"/>
    <rect x="104" y="216" width="46" height="80" rx="16" fill="#fff" stroke="none"/>
    <rect x="362" y="216" width="46" height="80" rx="16" fill="#fff" stroke="none"/>
  </g>
</svg>`;

export const ICON_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  ICON_SVG
)}`;

// Versão "maskable": mesmo ícone com margem de segurança (safe zone) para
// não ser cortado quando o sistema aplica máscara circular.
export const ICON_MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0c964b"/>
  <g fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" transform="translate(256 256) scale(0.72) translate(-256 -256)">
    <path d="M150 200v112M362 200v112M150 256h212"/>
    <rect x="104" y="216" width="46" height="80" rx="16" fill="#fff" stroke="none"/>
    <rect x="362" y="216" width="46" height="80" rx="16" fill="#fff" stroke="none"/>
  </g>
</svg>`;

export const ICON_MASKABLE_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  ICON_MASKABLE_SVG
)}`;
