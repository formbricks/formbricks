export const deviceType = (userAgent: string): "desktop" | "phone" =>
  !!userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i)
    ? "phone"
    : "desktop";
