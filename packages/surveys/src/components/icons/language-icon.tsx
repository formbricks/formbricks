interface LanguageIconProps {
  className?: string;
}

export const LanguageIcon = ({ className }: LanguageIconProps) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}>
      <g clip-path="url(#clip0_4252_104)">
        <path
          d="M3.33325 5.33398L7.33325 9.33398M2.66659 9.33398L6.66659 5.33398L7.99992 3.33398M1.33325 3.33398H9.33325M4.66659 1.33398H5.33325M14.6666 14.6673L11.3333 8.00065L7.99992 14.6673M9.33325 12.0007H13.3333"
          stroke="currentColor"
          stroke-width="1.33"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_4252_104">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
