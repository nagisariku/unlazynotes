/**
 * Local Formatting Cleanup (Zero AI)
 * 
 * Aturan:
 * 1. Normalisasi baris baru (\r\n -> \n, \r -> \n).
 * 2. Hapus spasi berlebih di akhir baris (line.trimEnd()).
 * 3. Standarisasi bullet di awal baris: `• ` atau `* ` diubah rapi jadi `- ` dengan mempertahankan indentasi.
 * 4. List / Numbering: DILARANG ada baris kosong (breakline) antar item list/numbering berturut-turut.
 * 5. Hindari > 1x breakline (maksimal 1 baris kosong antar paragraf / \n\n).
 * 6. ATURAN MUTLAK: Dilarang keras mengubah huruf besar-kecil, kata, istilah, singkatan, angka, atau tanda baca asli pengguna.
 */

export function cleanLocalFormat(content: string): string {
  if (!content) return '';

  // 1. Normalisasi baris baru (\r\n -> \n, \r -> \n)
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Trim trailing spaces pada setiap baris & standarisasi bullet awal (•, ·, ∙, ◦, ●, ○, ■, ▪, ▫, *, +, –, — -> -)
  const rawLines = normalized.split('\n').map((line) => {
    let trimmedEnd = line.trimEnd();
    trimmedEnd = trimmedEnd.replace(/^([ \t]*)[•·∙◦●○■▪▫*+\u2013\u2014-][ \t]+/, '$1- ');
    return trimmedEnd;
  });

  // Regex mendeteksi baris list / numbering:
  // - Bullet list: "- " atau "- [ ]" atau "- [x]"
  // - Numbering: "1. ", "1) ", "(1) ", "[1] ", "1: ", "1 - "
  // - Alphabetical: "a. ", "a) ", "(a) "
  // - Roman numerals: "i. ", "ii) " dsb.
  const isListItem = (line: string): boolean => {
    return /^[ \t]*(-|\d+[\.\)\:\-]|\[\d+\]|\(\d+\)|[a-zA-Z][\.\)]|\([a-zA-Z]\)|(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[\.\)])[ \t]+/i.test(line);
  };

  // Header atau introduksi list (misal: "daftar x:", "Bahan:", "Langkah-langkah:")
  const isListIntro = (line: string): boolean => {
    return /:\s*$/.test(line.trim());
  };

  // 3. Line-by-line assembly:
  // - Tidak ada baris kosong antara list/numbering items berturut-turut
  // - Tidak ada baris kosong antara pengantar list (berakhiran ':') dan list item pertama
  // - Maksimal 1 baris kosong antar paragraf biasa (\n\n)
  const resultLines: string[] = [];
  let pendingBlankLines = 0;
  let lastNonEmptyLine = '';

  for (const line of rawLines) {
    if (line.trim() === '') {
      pendingBlankLines++;
      continue;
    }

    if (resultLines.length > 0) {
      if (pendingBlankLines > 0) {
        // Cek jika antar list item berturut-turut atau dari header ':' ke item list pertama
        if (
          (isListItem(lastNonEmptyLine) && isListItem(line)) ||
          (isListIntro(lastNonEmptyLine) && isListItem(line))
        ) {
          // Jangan ada baris kosong
        } else {
          // Antar paragraf/elemen berbeda, batasi maksimal 1 baris kosong
          resultLines.push('');
        }
      }
    }

    resultLines.push(line);
    lastNonEmptyLine = line;
    pendingBlankLines = 0;
  }

  // 4. Bersihkan spasi/baris kosong di awal dan akhir teks keseluruhan
  return resultLines.join('\n').trim();
}
