/**
 * Local Formatting Cleanup (Zero AI)
 * 
 * Aturan:
 * 1. Normalisasi baris baru (\r\n -> \n, \r -> \n).
 * 2. Hapus spasi berlebih di akhir baris (line.trimEnd()).
 * 3. Batasi jeda enter kosong berlebih (maksimal 2 baris kosong berturut-turut / \n\n\n).
 * 4. Rapikan indentasi bullet/list yang berantakan (misal `• ` atau `* ` diubah rapi jadi `- `).
 * 5. ATURAN MUTLAK: Dilarang keras mengubah huruf besar-kecil, kata, istilah, singkatan, atau tanda baca asli pengguna.
 */

export function cleanLocalFormat(content: string): string {
  if (!content) return '';

  // 1. Normalisasi baris baru
  let text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Trim trailing spaces pada setiap baris & rapikan bullet/list
  const lines = text.split('\n').map((line) => {
    let trimmedEnd = line.trimEnd();

    // Standarisasi bullet: ganti bullet list `• ` atau `* ` di awal baris (dengan mempertahankan indentasi) menjadi `- `
    // Contoh: "• Beli kopi" -> "- Beli kopi"
    // Contoh: "  * Belajar TS" -> "  - Belajar TS"
    trimmedEnd = trimmedEnd.replace(/^([ \t]*)[•*][ \t]+/, '$1- ');

    return trimmedEnd;
  });

  text = lines.join('\n');

  // 3. Batasi jeda enter kosong berlebih (maksimal 2 baris kosong berturut-turut, yaitu \n\n\n)
  text = text.replace(/\n{4,}/g, '\n\n\n');

  // 4. Bersihkan spasi/baris kosong di awal dan akhir teks keseluruhan
  return text.trim();
}
