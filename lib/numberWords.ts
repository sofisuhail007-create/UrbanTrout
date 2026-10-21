/**
 * Converts a number to Indian Currency Words (e.g. 24600 -> "Twenty Four Thousand Six Hundred Rupees Only")
 */
export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return "Zero Rupees Only";

  const num = Math.round(Math.abs(amount));

  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertLessThanOneThousand(n: number): string {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  let words = "";

  const crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  if (crore > 0) {
    words += convertLessThanOneThousand(crore) + "Crore ";
  }
  if (lakh > 0) {
    words += convertLessThanOneThousand(lakh) + "Lakh ";
  }
  if (thousand > 0) {
    words += convertLessThanOneThousand(thousand) + "Thousand ";
  }
  if (remainder > 0) {
    words += convertLessThanOneThousand(remainder);
  }

  const clean = words.replace(/\s+/g, " ").trim();
  return clean ? `${clean} Rupees Only` : "Zero Rupees Only";
}
