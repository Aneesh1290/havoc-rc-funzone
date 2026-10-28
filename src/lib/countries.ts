export interface CountryCode {
  name: string;
  code: string; // ISO 2-letter
  dialCode: string;
  flag: string;
  minDigits?: number;
  maxDigits?: number;
  placeholder?: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳", minDigits: 10, maxDigits: 10, placeholder: "98765 43210" },
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸", minDigits: 10, maxDigits: 10, placeholder: "202 555 0123" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧", minDigits: 10, maxDigits: 10, placeholder: "7911 123456" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪", minDigits: 9, maxDigits: 9, placeholder: "50 123 4567" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦", minDigits: 9, maxDigits: 9, placeholder: "50 123 4567" },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦", minDigits: 8, maxDigits: 8, placeholder: "3312 3456" },
  { name: "Kuwait", code: "KW", dialCode: "+965", flag: "🇰🇼", minDigits: 8, maxDigits: 8, placeholder: "9123 4567" },
  { name: "Oman", code: "OM", dialCode: "+968", flag: "🇴🇲", minDigits: 8, maxDigits: 8, placeholder: "9123 4567" },
  { name: "Bahrain", code: "BH", dialCode: "+973", flag: "🇧🇭", minDigits: 8, maxDigits: 8, placeholder: "3912 3456" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬", minDigits: 8, maxDigits: 8, placeholder: "8123 4567" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾", minDigits: 9, maxDigits: 10, placeholder: "12 345 6789" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺", minDigits: 9, maxDigits: 9, placeholder: "412 345 678" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦", minDigits: 10, maxDigits: 10, placeholder: "416 555 0123" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Sweden", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Norway", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Denmark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
  { name: "Thailand", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "🇧🇩" },
  { name: "Nepal", code: "NP", dialCode: "+977", flag: "🇳🇵" },
  { name: "Maldives", code: "MV", dialCode: "+960", flag: "🇲🇻" },
  { name: "Bhutan", code: "BT", dialCode: "+975", flag: "🇧🇹" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
  { name: "Afghanistan", code: "AF", dialCode: "+93", flag: "🇦🇫" },
  { name: "Albania", code: "AL", dialCode: "+355", flag: "🇦🇱" },
  { name: "Algeria", code: "DZ", dialCode: "+213", flag: "🇩🇿" },
  { name: "Argentina", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Armenia", code: "AM", dialCode: "+374", flag: "🇦🇲" },
  { name: "Austria", code: "AT", dialCode: "+43", flag: "🇦🇹" },
  { name: "Azerbaijan", code: "AZ", dialCode: "+994", flag: "🇦🇿" },
  { name: "Belgium", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Bulgaria", code: "BG", dialCode: "+359", flag: "🇧🇬" },
  { name: "Chile", code: "CL", dialCode: "+56", flag: "🇨🇱" },
  { name: "Colombia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Croatia", code: "HR", dialCode: "+385", flag: "🇭🇷" },
  { name: "Cyprus", code: "CY", dialCode: "+357", flag: "🇨🇾" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Estonia", code: "EE", dialCode: "+372", flag: "🇪🇪" },
  { name: "Finland", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "Georgia", code: "GE", dialCode: "+995", flag: "🇬🇪" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Greece", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Hungary", code: "HU", dialCode: "+36", flag: "🇭🇺" },
  { name: "Iceland", code: "IS", dialCode: "+354", flag: "🇮🇸" },
  { name: "Israel", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Jordan", code: "JO", dialCode: "+962", flag: "🇯🇴" },
  { name: "Kazakhstan", code: "KZ", dialCode: "+7", flag: "🇰🇿" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Lebanon", code: "LB", dialCode: "+961", flag: "🇱🇧" },
  { name: "Luxembourg", code: "LU", dialCode: "+352", flag: "🇱🇺" },
  { name: "Mauritius", code: "MU", dialCode: "+230", flag: "🇲🇺" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Morocco", code: "MA", dialCode: "+212", flag: "🇲🇦" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Poland", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Romania", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Russia", code: "RU", dialCode: "+7", flag: "🇷🇺" },
  { name: "Serbia", code: "RS", dialCode: "+381", flag: "🇷🇸" },
  { name: "Slovakia", code: "SK", dialCode: "+421", flag: "🇸🇰" },
  { name: "Slovenia", code: "SI", dialCode: "+386", flag: "🇸🇮" },
  { name: "Turkey", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flag: "🇺🇦" },
];

export function getCountryByDialCode(dialCode: string): CountryCode | undefined {
  const clean = (dialCode || "").trim();
  return COUNTRY_CODES.find((c) => c.dialCode === clean || c.code === clean);
}

export function getExpectedPhoneDigits(country: CountryCode | undefined): { min: number; max: number; placeholder: string } {
  if (!country) return { min: 7, max: 15, placeholder: "Phone Number" };
  const min = country.minDigits || (country.dialCode === "+91" ? 10 : 7);
  const max = country.maxDigits || (country.dialCode === "+91" ? 10 : 15);
  const placeholder = country.placeholder || (country.dialCode === "+91" ? "98765 43210" : "Phone Number");
  return { min, max, placeholder };
}

export function validatePhoneNumber(rawDigits: string, country: CountryCode | undefined): { valid: boolean; error?: string } {
  const digits = (rawDigits || "").replace(/\D/g, "");
  const { min, max } = getExpectedPhoneDigits(country);
  const countryName = country?.name || "selected country";

  if (!digits) {
    return { valid: false, error: "Please enter your mobile number." };
  }

  if (min === max) {
    if (digits.length !== min) {
      return {
        valid: false,
        error: `${countryName} mobile numbers must be exactly ${min} digits (you entered ${digits.length}).`,
      };
    }
  } else {
    if (digits.length < min || digits.length > max) {
      return {
        valid: false,
        error: `${countryName} mobile numbers must be between ${min} and ${max} digits (you entered ${digits.length}).`,
      };
    }
  }

  // Extra check for India: must start with 6, 7, 8, or 9
  if (country?.dialCode === "+91" && !/^[6-9]/.test(digits)) {
    return {
      valid: false,
      error: "Indian mobile numbers must start with 6, 7, 8, or 9.",
    };
  }

  return { valid: true };
}
