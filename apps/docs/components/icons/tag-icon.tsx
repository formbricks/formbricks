export function TagIcon(props: React.ComponentPropsWithoutRef<"svg">): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <path
        strokeWidth="0"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 8.69499V3H8.69499C9.18447 3 9.65389 3.19444 10 3.54055L16.4594 10C17.1802 10.7207 17.1802 11.8893 16.4594 12.61L12.61 16.4594C11.8893 17.1802 10.7207 17.1802 10 16.4594L3.54055 10C3.19444 9.65389 3 9.18447 3 8.69499ZM7 8.5C7.82843 8.5 8.5 7.82843 8.5 7C8.5 6.17157 7.82843 5.5 7 5.5C6.17157 5.5 5.5 6.17157 5.5 7C5.5 7.82843 6.17157 8.5 7 8.5Z"
      />
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3V8.69499C3 9.18447 3.19444 9.65389 3.54055 10L10 16.4594C10.7207 17.1802 11.8893 17.1802 12.61 16.4594L16.4594 12.61C17.1802 11.8893 17.1802 10.7207 16.4594 10L10 3.54055C9.65389 3.19444 9.18447 3 8.69499 3H3Z"
      />
      <circle cx="7" cy="7" r="1.5" fill="none" />
    </svg>
  );
}
