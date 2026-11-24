const colors = {
  platinum: "#F0F5F8",
  alabaster: "#DADFE1",
  pacific: "#2DAEEB",
  carbon: "#1D2124",
  ochre: "#D62600",
  white: "#FFFFFF",
};

function luminance(hex) {
  const rgb = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

const pairs = [
  ["Pacific Cyan / Carbon", colors.pacific, colors.carbon, true],
  ["Pacific Cyan / white", colors.pacific, colors.white, false],
  ["Carbon / Platinum", colors.carbon, colors.platinum, true],
  ["Carbon / Alabaster", colors.carbon, colors.alabaster, true],
  ["Red Ochre / Platinum", colors.ochre, colors.platinum, true],
  ["Red Ochre / white", colors.ochre, colors.white, true],
];

for (const [label, foreground, background, required] of pairs) {
  const ratio = contrast(foreground, background);
  console.log(`${label}: ${ratio.toFixed(2)}:1${required ? "" : " (not for text)"}`);
  if (required && ratio < 4.5) process.exitCode = 1;
}
