const fs = require("fs");
const path = require("path");

const FONT_URL =
  "https://raw.githubusercontent.com/notofonts/tamil/main/fonts/NotoSansTamil/googlefonts/ttf/NotoSansTamil-Regular.ttf";

async function main() {
  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error(`Failed to download Noto Sans Tamil: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const output = path.join(process.cwd(), "lib", "tamil-font.ts");

  fs.writeFileSync(
    output,
    "export const tamilFontBase64 = " +
      JSON.stringify(buffer.toString("base64")) +
      ";\n"
  );

  console.log("Prepared Noto Sans Tamil font:", buffer.length, "bytes");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
