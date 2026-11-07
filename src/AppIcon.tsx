import React from "react";
import type { AppIconName } from "./types";

/** Ikon aplikasi generik berbentuk kotak membulat (sengaja bukan logo merek dagang). */
export const AppIcon: React.FC<{ name: AppIconName; size: number }> = ({ name, size }) => {
  let body: React.ReactNode;
  switch (name) {
    case "chat":
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#10A37F" />
          <path d="M12 5.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.5.7 2.800 1.900 3.800L6.700 18l3.200-1.400c.7.200 1.400.3 2.100.3 3.600 0 6.500-2.400 6.500-5.400S15.600 5.500 12 5.500z" fill="#fff" />
        </>
      );
      break;
    case "spark":
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#fff" stroke="#E2E4EA" />
          <path d="M12 3.500c.5 4.800 3.200 7.500 8 8-4.800.5-7.500 3.200-8 8-.5-4.800-3.200-7.500-8-8 4.800-.5 7.500-3.200 8-8z" fill="#4C7CF3" />
        </>
      );
      break;
    case "folder":
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#FFC83D" />
          <path d="M4.500 8.500a1.500 1.500 0 0 1 1.500-1.500h3.200l1.800 2H18a1.500 1.500 0 0 1 1.500 1.500v6A1.500 1.500 0 0 1 18 18H6a1.500 1.500 0 0 1-1.500-1.500z" fill="#fff" />
        </>
      );
      break;
    case "sheet":
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#1FA463" />
          <rect x="6.500" y="5.500" width="11" height="13" rx="1.500" fill="#fff" />
          <path d="M8.500 10h7M8.500 13h7M8.500 16h4M12 8v10" stroke="#1FA463" strokeWidth="1.100" />
        </>
      );
      break;
    case "ads":
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#1877F2" />
          <rect x="6" y="12" width="3" height="6" rx="1" fill="#fff" />
          <rect x="10.500" y="8.500" width="3" height="9.500" rx="1" fill="#fff" />
          <rect x="15" y="5.500" width="3" height="12.500" rx="1" fill="#fff" />
        </>
      );
      break;
    default:
      body = (
        <>
          <rect width="24" height="24" rx="6" fill="#111" />
          <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="#fff" strokeWidth="1.300" />
          <path d="M9.500 4.500v2.500M14.500 4.500v2.500M9.500 17v2.500M14.500 17v2.500M4.500 9.500H7M4.500 14.500H7M17 9.500h2.500M17 14.500h2.500" stroke="#fff" strokeWidth="1.300" strokeLinecap="round" />
          <text x="12" y="14.300" textAnchor="middle" fontSize="5.500" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">AI</text>
        </>
      );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </svg>
  );
};
