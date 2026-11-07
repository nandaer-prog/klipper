import React from "react";
import type { IconName } from "./types";
import { anton } from "./fonts";

type Props = { name: IconName; size: number; color?: string };

/** Ikon vektor sederhana (tidak bergantung font emoji di mesin render). */
export const Icon: React.FC<Props> = ({ name, size, color = "#FFE600" }) => {
  const id = `g-${name}`;
  const fill = `url(#${id})`;
  const stroke = "#1a1a2e";
  const common = { fill, stroke, strokeWidth: 1.1, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (name) {
    case "fire":
      body = (
        <path
          {...common}
          d="M12 2c1.2 4.2-3.4 5.4-3.4 9.6a4.4 4.4 0 0 0 8.8 0c0-2.2-1.1-3.5-2.3-4.7.1 2.1-.9 3.2-2 3.4 1.2-3.2.8-5.8-1.1-8.3z"
        />
      );
      break;
    case "warning":
      body = (
        <>
          <path {...common} d="M12 2.5l10 17.5H2z" />
          <rect x="11" y="8.5" width="2" height="6" rx="1" fill={stroke} />
          <circle cx="12" cy="17" r="1.2" fill={stroke} />
        </>
      );
      break;
    case "money":
      body = (
        <>
          <circle {...common} cx="12" cy="12" r="9.5" />
          <text
            x="12"
            y="16.6"
            textAnchor="middle"
            fontSize="13"
            fontFamily={anton}
            fill={stroke}
          >
            $
          </text>
        </>
      );
      break;
    case "heart":
      body = (
        <path
          {...common}
          d="M12 21s-7.5-4.6-9.6-9.3A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.6 5.5C19.5 16.4 12 21 12 21z"
        />
      );
      break;
    case "star":
      body = (
        <path
          {...common}
          d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z"
        />
      );
      break;
    case "check":
      body = (
        <>
          <circle {...common} cx="12" cy="12" r="9.5" />
          <path
            d="M7 12.4l3.3 3.3L17 9"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    case "bolt":
      body = <path {...common} d="M13.5 1.5L4 14h6.3l-1.3 8.5L20 9.5h-6.6z" />;
      break;
    case "clock":
      body = (
        <>
          <circle {...common} cx="12" cy="12" r="9.5" />
          <path
            d="M12 6.5V12l3.8 2.2"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    case "bulb":
      body = (
        <>
          <path
            {...common}
            d="M12 2a6.5 6.5 0 0 0-3.8 11.8c.6.5.8 1 .8 1.7V17h6v-1.5c0-.7.2-1.2.8-1.7A6.5 6.5 0 0 0 12 2z"
          />
          <rect x="9.3" y="18" width="5.4" height="2.2" rx="1" fill={stroke} />
        </>
      );
      break;
    case "shield":
      body = (
        <>
          <path {...common} d="M12 2l8 3v6c0 5.2-3.5 9.2-8 11-4.5-1.8-8-5.8-8-11V5z" />
          <path
            d="M8.5 12l2.5 2.5L15.6 9.8"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    default:
      body = (
        <>
          <path {...common} d="M3 11.2L12 3l9 8.2V21h-6v-6.2H9V21H3z" />
        </>
      );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
};
